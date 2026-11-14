/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type express from 'express';
import Router from 'express-promise-router';
import { HttpAuthService, PermissionsService, UrlReaderService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  parseWorkflowYaml,
  temporalReadPermission,
  temporalRunReadPermission,
} from '@acarmisc/backstage-plugin-temporal-common';
import { TemporalService } from './service';

export interface RouterOptions {
  service: TemporalService;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  urlReader: UrlReaderService;
}

const MAX_RUNS = 100;

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new InputError(`query parameter "${name}" is required`);
  }
  return value;
}

export function createRouter({ service, httpAuth, permissions, urlReader }: RouterOptions) {
  const router = Router();
  async function allowed(req: express.Request, permission: typeof temporalReadPermission) {
    const credentials = await httpAuth.credentials(req);
    const [decision] = await permissions.authorize([{ permission }], { credentials });
    return decision.result === AuthorizeResult.ALLOW;
  }

  // Every route needs an authenticated user holding temporal.read.
  async function guard(req: express.Request, res: express.Response) {
    if (await allowed(req, temporalReadPermission)) {
      return true;
    }
    res.status(403).json({ error: `missing permission ${temporalReadPermission.name}` });
    return false;
  }

  router.get('/clusters', async (req, res) => {
    if (!(await guard(req, res))) return;
    res.json(service.listClusters());
  });

  router.get('/health', async (req, res) => {
    if (!(await guard(req, res))) return;
    res.json(await service.health());
  });

  router.get('/streams', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const namespace = required(req.query.namespace, 'namespace');
    res.json(await service.listStreams(cluster, namespace));
  });

  router.get('/streams/:name/runs', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const namespace = required(req.query.namespace, 'namespace');
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), MAX_RUNS);
    if (!Number.isFinite(limit)) {
      throw new InputError('limit must be a number');
    }
    res.json(await service.listRuns(cluster, namespace, req.params.name, limit));
  });

  // Wildcard: workflow ids contain slashes (stream/<name>/<timestamp>).
  router.get('/runs/*', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const namespace = required(req.query.namespace, 'namespace');
    const workflowId = (req.params as unknown as string[])[0];
    const includeOutput = await allowed(req, temporalRunReadPermission);
    res.json(await service.getRun(cluster, namespace, workflowId, includeOutput));
  });

  // Definition from a YAML file in a repository. UrlReader only reads hosts
  // configured under `integrations`, so this is not a general-purpose fetch.
  router.get('/definitions', async (req, res) => {
    if (!(await guard(req, res))) return;
    const location = required(req.query.location, 'location');
    const buffer = await (await urlReader.readUrl(location)).buffer();
    res.json(parseWorkflowYaml(buffer.toString('utf8')));
  });

  return router;
}
