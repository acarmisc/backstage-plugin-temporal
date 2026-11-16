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
import { isListStatus, ListStatus, TemporalService } from './service';

export interface RouterOptions {
  service: TemporalService;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  urlReader: UrlReaderService;
  // Optional: `createRouter` callers may leave the RBAC knobs at their defaults.
  temporalConfig?: {
    enabled?: boolean;
    readPermission?: typeof temporalReadPermission;
    runReadPermission?: typeof temporalRunReadPermission;
  };
}

const MAX_RUNS = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new InputError(`query parameter "${name}" is required`);
  }
  return value;
}

function optional(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InputError(`query parameter "${name}" must be given once`);
  }
  return value;
}

function statusesOf(value: unknown): ListStatus[] {
  const names = (optional(value, 'status') ?? '').split(',').map(name => name.trim()).filter(Boolean);
  const unknown = names.find(name => !isListStatus(name));
  if (unknown !== undefined) {
    throw new InputError(`unknown status "${unknown}"`);
  }
  return names as ListStatus[];
}

function startTimeOf(value: unknown): string | undefined {
  const startTime = optional(value, 'startTime');
  if (startTime !== undefined && Number.isNaN(Date.parse(startTime))) {
    throw new InputError('startTime must be an ISO date');
  }
  return startTime;
}

function pageSizeOf(value: unknown): number {
  const size = optional(value, 'pageSize');
  if (size === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  if (!Number.isFinite(Number(size))) {
    throw new InputError('pageSize must be a number');
  }
  return Math.min(Math.max(Math.floor(Number(size)), 1), MAX_PAGE_SIZE);
}

export function createRouter({
  service,
  httpAuth,
  permissions,
  urlReader,
  temporalConfig = {},
}: RouterOptions) {
  const router = Router();
  const {
    enabled = true,
    readPermission = temporalReadPermission,
    runReadPermission = temporalRunReadPermission,
  } = temporalConfig;

  async function allowed(req: express.Request, permission: typeof temporalReadPermission) {
    if (!enabled) return true;
    const credentials = await httpAuth.credentials(req);
    const [decision] = await permissions.authorize([{ permission }], { credentials });
    return decision.result === AuthorizeResult.ALLOW;
  }

  // Every route needs an authenticated user holding temporal.read.
  async function guard(req: express.Request, res: express.Response) {
    if (await allowed(req, readPermission)) {
      return true;
    }
    res.status(403).json({ error: `missing permission ${readPermission.name}` });
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
    const includeOutput = await allowed(req, runReadPermission);
    res.json(await service.getRun(cluster, namespace, workflowId, includeOutput));
  });

  // Workflow browser: any workflow in an allowed namespace, not only stream workflows.
  router.get('/workflows', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const namespace = required(req.query.namespace, 'namespace');
    res.json(
      await service.listWorkflows(cluster, namespace, {
        statuses: statusesOf(req.query.status),
        workflowType: optional(req.query.workflowType, 'workflowType'),
        startTime: startTimeOf(req.query.startTime),
        pageSize: pageSizeOf(req.query.pageSize),
        nextPageToken: optional(req.query.nextPageToken, 'nextPageToken'),
      }),
    );
  });

  // Workflow ids may contain slashes, so the browser sends them encoded (%2F).
  router.get('/workflows/:namespace/:workflowId/:runId', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const includePayloads = await allowed(req, runReadPermission);
    res.json(
      await service.getWorkflow(
        cluster,
        req.params.namespace,
        req.params.workflowId,
        req.params.runId,
        includePayloads,
      ),
    );
  });

  router.get('/workflows/:namespace/:workflowId/:runId/history', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const includePayloads = await allowed(req, runReadPermission);
    res.json(
      await service.getHistory(
        cluster,
        req.params.namespace,
        req.params.workflowId,
        req.params.runId,
        includePayloads,
      ),
    );
  });

  router.get('/schedules', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const namespace = required(req.query.namespace, 'namespace');
    res.json(await service.listSchedules(cluster, namespace));
  });

  router.get('/schedules/:scheduleId', async (req, res) => {
    if (!(await guard(req, res))) return;
    const cluster = required(req.query.cluster, 'cluster');
    const namespace = required(req.query.namespace, 'namespace');
    res.json(await service.getSchedule(cluster, namespace, req.params.scheduleId));
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
