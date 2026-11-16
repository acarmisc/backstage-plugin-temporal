/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { AddressInfo } from 'net';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  temporalReadPermission,
  temporalRunReadPermission,
} from '@acarmisc/backstage-plugin-temporal-common';
import { createRouter } from './router';
import { TemporalService } from './service';

type Decision = (permissionName: string) => AuthorizeResult;

async function start(decide: Decision, service: Partial<TemporalService>) {
  const app = express();
  app.use(
    '/api/temporal',
    createRouter({
      service: service as TemporalService,
      httpAuth: { credentials: async () => ({}) } as never,
      permissions: {
        authorize: async (requests: Array<{ permission: { name: string } }>) =>
          requests.map(r => ({ result: decide(r.permission.name) })),
      } as never,
      urlReader: {} as never,
    }),
  );
  // Stand-in for Backstage's error middleware, which maps @backstage/errors classes by name.
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = { InputError: 400, NotFoundError: 404 }[err.name] ?? 500;
    res.status(status).json({ error: err.message });
  });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/api/temporal`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

describe('temporal router', () => {
  const allowAll = () => AuthorizeResult.ALLOW;

  it('refuses every route without temporal.read', async () => {
    const server = await start(
      name => (name === temporalReadPermission.name ? AuthorizeResult.DENY : AuthorizeResult.ALLOW),
      { listClusters: () => [] },
    );
    try {
      const res = await fetch(`${server.url}/clusters`);
      expect(res.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('withholds output from run detail without temporal.run.read', async () => {
    const getRun = jest.fn(async () => ({ stages: [] }));
    const server = await start(
      name => (name === temporalRunReadPermission.name ? AuthorizeResult.DENY : AuthorizeResult.ALLOW),
      { getRun: getRun as never },
    );
    try {
      const res = await fetch(
        `${server.url}/runs/stream/crm-jira/20261114T102908?cluster=staging&namespace=kb`,
      );
      expect(res.status).toBe(200);
      expect(getRun).toHaveBeenCalledWith('staging', 'kb', 'stream/crm-jira/20261114T102908', false);
    } finally {
      await server.close();
    }
  });

  it('passes output through when temporal.run.read is granted', async () => {
    const getRun = jest.fn(async () => ({ stages: [] }));
    const server = await start(allowAll, { getRun: getRun as never });
    try {
      await fetch(`${server.url}/runs/stream/crm-jira/1?cluster=staging&namespace=kb`);
      expect(getRun).toHaveBeenCalledWith('staging', 'kb', 'stream/crm-jira/1', true);
    } finally {
      await server.close();
    }
  });

  it('asks for cluster and namespace', async () => {
    const server = await start(allowAll, { listStreams: async () => [] });
    try {
      const res = await fetch(`${server.url}/streams`);
      expect(res.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('lists schedules for a namespace and requires temporal.read', async () => {
    const listSchedules = jest.fn(async () => ({ schedules: [] }));
    const open = await start(allowAll, { listSchedules: listSchedules as never });
    try {
      expect((await fetch(`${open.url}/schedules`)).status).toBe(400);
      const res = await fetch(`${open.url}/schedules?cluster=staging&namespace=kb`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ schedules: [] });
      expect(listSchedules).toHaveBeenCalledWith('staging', 'kb');
    } finally {
      await open.close();
    }
    const denied = await start(() => AuthorizeResult.DENY, { listSchedules: listSchedules as never });
    try {
      expect((await fetch(`${denied.url}/schedules?cluster=staging&namespace=kb`)).status).toBe(403);
    } finally {
      await denied.close();
    }
  });

  it('parses the workflow list parameters', async () => {
    const listWorkflows = jest.fn(async () => ({ workflows: [] }));
    const server = await start(allowAll, { listWorkflows: listWorkflows as never });
    try {
      const res = await fetch(
        `${server.url}/workflows?cluster=staging&namespace=kb&status=FAILED,RUNNING&workflowType=Crm&startTime=2026-11-01T00:00:00Z&pageSize=500`,
      );
      expect(res.status).toBe(200);
      expect(listWorkflows).toHaveBeenCalledWith('staging', 'kb', {
        statuses: ['FAILED', 'RUNNING'],
        workflowType: 'Crm',
        startTime: '2026-11-01T00:00:00Z',
        pageSize: 100,
      });
    } finally {
      await server.close();
    }
  });

  it('rejects an unknown status in the workflow list', async () => {
    const listWorkflows = jest.fn(async () => ({ workflows: [] }));
    const server = await start(allowAll, { listWorkflows: listWorkflows as never });
    try {
      const res = await fetch(`${server.url}/workflows?cluster=staging&namespace=kb&status=FAILED,BOGUS`);
      expect(res.status).toBe(400);
      expect(listWorkflows).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('decodes an encoded slash in the workflow id', async () => {
    const getWorkflow = jest.fn(async () => ({}));
    const server = await start(allowAll, { getWorkflow: getWorkflow as never });
    try {
      await fetch(`${server.url}/workflows/kb/stream%2Fa%2F1/run-1?cluster=staging`);
      expect(getWorkflow).toHaveBeenCalledWith('staging', 'kb', 'stream/a/1', 'run-1', true);
    } finally {
      await server.close();
    }
  });

  it('withholds payloads from workflow detail and history without temporal.run.read', async () => {
    const getWorkflow = jest.fn(async () => ({}));
    const getHistory = jest.fn(async () => ({ events: [], truncated: false }));
    const server = await start(
      name => (name === temporalRunReadPermission.name ? AuthorizeResult.DENY : AuthorizeResult.ALLOW),
      { getWorkflow: getWorkflow as never, getHistory: getHistory as never },
    );
    try {
      await fetch(`${server.url}/workflows/kb/stream%2Fa%2F1/run-1?cluster=staging`);
      await fetch(`${server.url}/workflows/kb/stream%2Fa%2F1/run-1/history?cluster=staging`);
      expect(getWorkflow).toHaveBeenCalledWith('staging', 'kb', 'stream/a/1', 'run-1', false);
      expect(getHistory).toHaveBeenCalledWith('staging', 'kb', 'stream/a/1', 'run-1', false);
    } finally {
      await server.close();
    }
  });

  it('passes history payloads through when temporal.run.read is granted', async () => {
    const getHistory = jest.fn(async () => ({ events: [], truncated: false }));
    const server = await start(allowAll, { getHistory: getHistory as never });
    try {
      await fetch(`${server.url}/workflows/kb/run-1/run-2/history?cluster=staging`);
      expect(getHistory).toHaveBeenCalledWith('staging', 'kb', 'run-1', 'run-2', true);
    } finally {
      await server.close();
    }
  });
});
