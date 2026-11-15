/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigReader } from '@backstage/config';
import { Connection } from '@temporalio/client';
import defaultPlugin, { temporalPlugin } from './index';
import { TtlCache } from './cache';
import { readTemporalConfig } from './config';
import { createRedactor } from './redact';
import { streamNameOf, TemporalService } from './service';

describe('createRedactor', () => {
  const redactor = createRedactor();

  it('masks key=value secrets, bearer tokens and well-known token prefixes', () => {
    expect(redactor.text('connecting with password=hunter2 now')).toBe(
      'connecting with [REDACTED] now',
    );
    expect(redactor.text('Authorization: Bearer abc.def-123')).toContain('[REDACTED]');
    expect(redactor.text('clone with glpat-ABCDEFGH1234')).toBe('clone with [REDACTED]');
  });

  it('leaves ordinary output alone', () => {
    expect(redactor.text('exported 42 pages in 3 s')).toBe('exported 42 pages in 3 s');
  });

  it('truncates long output and says so', () => {
    const short = createRedactor({ maxLength: 10 });
    expect(short.text('x'.repeat(50))).toBe(`${'x'.repeat(10)}… [truncated]`);
  });

  it('masks parameters whose key looks sensitive', () => {
    expect(
      redactor.params({ repo: 'https://example.com/a.git', api_token: 'abc', dest: '/tmp' }),
    ).toEqual({ repo: 'https://example.com/a.git', api_token: '[REDACTED]', dest: '/tmp' });
  });

  it('deep-copies values, masking sensitive keys and secret patterns without truncating', () => {
    const short = createRedactor({ maxLength: 5 });
    const copy = short.deep({
      note: `${'x'.repeat(20)} password=hunter2`,
      api_token: 'abc',
      nested: [{ auth: { user: 'a' } }, 42, null],
    });
    expect(copy).toEqual({
      note: `${'x'.repeat(20)} [REDACTED]`,
      api_token: '[REDACTED]',
      nested: [{ auth: '[REDACTED]' }, 42, null],
    });
  });
});

describe('TtlCache', () => {
  it('shares one load between concurrent callers', async () => {
    const cache = new TtlCache(1000);
    const load = jest.fn(async () => 'value');
    const [a, b] = await Promise.all([cache.getOrLoad('k', load), cache.getOrLoad('k', load)]);
    expect([a, b]).toEqual(['value', 'value']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reloads after the ttl', async () => {
    let now = 0;
    const cache = new TtlCache(1000, () => now);
    const load = jest.fn(async () => 'v');
    await cache.getOrLoad('k', load);
    now = 1500;
    await cache.getOrLoad('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load', async () => {
    const cache = new TtlCache(1000);
    await expect(cache.getOrLoad('k', async () => { throw new Error('down'); })).rejects.toThrow('down');
    const load = jest.fn(async () => 'ok');
    await expect(cache.getOrLoad('k', load)).resolves.toBe('ok');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('streamNameOf', () => {
  it('reads the stream name from a manual run id', () => {
    expect(streamNameOf('stream/crm-jira/20261114T102908', 'stream/')).toBe('crm-jira');
  });

  it('reads the stream name from a schedule run id (RFC 3339 action time)', () => {
    expect(streamNameOf('stream/crm-jira-2026-11-15T03:00:00Z', 'stream/')).toBe('crm-jira');
  });

  it('keeps dashes that belong to the stream name', () => {
    expect(streamNameOf('stream/ces-ai-kb-evidence/20261114T105914', 'stream/')).toBe('ces-ai-kb-evidence');
    expect(streamNameOf('stream/ces-ai-kb-evidence-2026-11-15T06:00:00Z', 'stream/')).toBe('ces-ai-kb-evidence');
  });

  it('ignores ids outside the prefix', () => {
    expect(streamNameOf('other/crm-jira/1', 'stream/')).toBeUndefined();
    expect(streamNameOf('stream//1', 'stream/')).toBeUndefined();
  });
});

describe('readTemporalConfig', () => {
  const base = {
    temporal: {
      clusters: [
        {
          name: 'staging',
          address: 'temporal-frontend.temporal.svc:7233',
          namespaces: ['kb'],
        },
      ],
    },
  };

  it('applies defaults', () => {
    const config = readTemporalConfig(new ConfigReader(base));
    expect(config.clusters[0]).toMatchObject({
      tls: false,
      streamPrefix: 'stream/',
      workflowTypes: ['StreamWorkflow'],
    });
    expect(config.cacheTtlMs).toBe(10_000);
    expect(config.redaction.maxTailLength).toBe(2000);
  });

  it('rejects a cluster without namespaces', () => {
    const config = new ConfigReader({
      temporal: { clusters: [{ name: 'x', address: 'a:1', namespaces: [] }] },
    });
    expect(() => readTemporalConfig(config)).toThrow(/namespaces must not be empty/);
  });

  it('rejects duplicate cluster names', () => {
    const cluster = { name: 'x', address: 'a:1', namespaces: ['kb'] };
    const config = new ConfigReader({ temporal: { clusters: [cluster, cluster] } });
    expect(() => readTemporalConfig(config)).toThrow(/unique names/);
  });

  it('passes TLS server name and PEM CA to the Temporal connection', async () => {
    const cluster = {
      ...base.temporal.clusters[0],
      tls: { enabled: true, serverName: 'temporal.example.com', caData: 'test PEM' },
    };
    const config = readTemporalConfig(new ConfigReader({ temporal: { clusters: [cluster] } }));
    const connect = jest.spyOn(Connection, 'connect').mockResolvedValue({
      workflowService: { getSystemInfo: async () => ({}) },
    } as never);
    try {
      await new TemporalService({ config }).health();
      expect(connect).toHaveBeenCalledWith(expect.objectContaining({
        tls: {
          serverNameOverride: 'temporal.example.com',
          serverRootCACertificate: Buffer.from('test PEM'),
        },
      }));
    } finally {
      connect.mockRestore();
    }
  });

  it('rejects TLS options when TLS is disabled', () => {
    const cluster = { ...base.temporal.clusters[0], tls: { enabled: false, caData: 'PEM' } };
    expect(() => readTemporalConfig(new ConfigReader({ temporal: { clusters: [cluster] } })))
      .toThrow(/tls.enabled is required/);
  });
});

it('exports the backend plugin as both default and named', () => {
  expect(defaultPlugin).toBe(temporalPlugin);
});
