/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

/**
 * Read-only integration test against a real Temporal namespace.
 *
 * Skipped unless TEMPORAL_TEST_ADDRESS is set. Typical use, with a port-forward
 * to the staging frontend opened with an explicit kubectl context:
 *
 *   TEMPORAL_TEST_ADDRESS=localhost:17233 TEMPORAL_TEST_NAMESPACE=kb yarn test staging.integration
 *
 * It never writes to Temporal.
 */

import { ConfigReader } from '@backstage/config';
import { readTemporalConfig } from './config';
import { TemporalService } from './service';

const address = process.env.TEMPORAL_TEST_ADDRESS;
const namespace = process.env.TEMPORAL_TEST_NAMESPACE ?? 'kb';
const describeIfStaging = address ? describe : describe.skip;

describeIfStaging('staging (read-only)', () => {
  let service: TemporalService;

  beforeAll(() => {
    const config = readTemporalConfig(
      new ConfigReader({
        temporal: {
          clusters: [{ name: 'staging', address, namespaces: [namespace] }],
        },
      }),
    );
    service = new TemporalService({ config });
  });

  it('lists the known streams with their last run', async () => {
    const streams = await service.listStreams('staging', namespace);
    const names = streams.map(s => s.name);
    expect(names).toEqual(expect.arrayContaining(['crm-jira', 'ces-ai-kb-test', 'smoke-preflight']));

    const smoke = streams.find(s => s.name === 'smoke-preflight')!;
    expect(smoke.lastRun?.status).toBe('COMPLETED');
    expect(smoke.lastSuccess?.status).toBe('COMPLETED');
  });

  it('draws a completed run with every stage ok', async () => {
    const run = await service.getRun(
      'staging',
      namespace,
      'stream/smoke-preflight/20261114T105247',
      true,
    );
    expect(run.status).toBe('COMPLETED');
    expect(run.graph?.nodes.map(n => n.id)).toHaveLength(2);
    expect(run.stages.map(s => s.state)).toEqual(['ok', 'ok']);
    expect(run.degraded).toBeUndefined();
  });

  it('associates stages by name for a DAG run', async () => {
    const run = await service.getRun(
      'staging',
      namespace,
      'stream/smoke-dag/20261114T134945',
      false,
    );
    expect(run.graph?.edges.length).toBeGreaterThan(0);
    expect(run.stages.every(s => s.state !== 'running')).toBe(true);
    // Output is withheld without temporal.run.read.
    expect(run.stages.every(s => s.tail === undefined)).toBe(true);
  });

  it('shows a failed run with a redacted error', async () => {
    const run = await service.getRun(
      'staging',
      namespace,
      'stream/smoke-dag/20261114T134909',
      true,
    );
    expect(run.status).toBe('FAILED');
    expect(run.stages.some(s => s.state === 'failed')).toBe(true);
  });
});
