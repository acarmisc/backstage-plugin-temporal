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
});
