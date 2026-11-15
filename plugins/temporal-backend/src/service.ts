/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Connection, RawWorkflowExecutionInfo } from '@temporalio/client';
import { NotFoundError } from '@backstage/errors';
import {
  ClusterHealth,
  ClusterSummary,
  parseWorkflowDefinition,
  RunDetail,
  RunStatus,
  RunSummary,
  ScheduleDetail,
  StreamSummary,
  TemporalHistoryEvent,
  TemporalWorkflowSummary,
  WorkflowExecutionDetail,
  WorkflowGraph,
  WorkflowHistoryResponse,
  WorkflowListResponse,
} from '@acarmisc/backstage-plugin-temporal-common';
import { ClusterConfig, TemporalConfig } from './config';
import { TtlCache } from './cache';
import {
  deriveStages,
  decodeFirstPayload,
  HistoryEvent,
  PendingActivity,
  stageNamesOf,
  timestampDate,
  toHistoryEvent,
  workflowInputOf,
  workflowStatusOf,
} from './history';
import { createRedactor, Redactor } from './redact';

const MAX_STREAM_SCAN = 500; // default scan bound; configured per cluster in TemporalConfig
const MAX_HISTORY_EVENTS = 2000;
const SCHEDULE_SUFFIX = /-\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

/** Statuses the workflow list can filter on. */
const LIST_STATUSES = [
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'TERMINATED',
  'TIMED_OUT',
  'CONTINUED_AS_NEW',
] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

// Visibility `ExecutionStatus` names.
const VISIBILITY_STATUS: Record<ListStatus, string> = {
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
  TERMINATED: 'Terminated',
  TIMED_OUT: 'TimedOut',
  CONTINUED_AS_NEW: 'ContinuedAsNew',
};

// WorkflowExecutionStatus enum values from the Temporal API.
const STATUS_BY_CODE: Record<number, string> = {
  1: 'RUNNING',
  2: 'COMPLETED',
  3: 'FAILED',
  4: 'CANCELED',
  5: 'TERMINATED',
  6: 'CONTINUED_AS_NEW',
  7: 'TIMED_OUT',
};

export function isListStatus(value: string): value is ListStatus {
  return (LIST_STATUSES as readonly string[]).includes(value);
}

export interface WorkflowListQuery {
  statuses: ListStatus[];
  workflowType?: string;
  /** ISO date: only workflows started at or after it. */
  startTime?: string;
  pageSize: number;
  /** Opaque token from the previous page. */
  nextPageToken?: string;
}

export interface TemporalServiceOptions {
  config: TemporalConfig;
  connect?: (cluster: ClusterConfig) => Promise<Connection>;
}

/**
 * Read-only access to Temporal, per configured cluster.
 * The browser never talks to Temporal: only this service does.
 */
export class TemporalService {
  private readonly connections = new Map<string, Promise<Connection>>();
  private readonly clients = new Map<string, Client>();
  private readonly cache: TtlCache;
  private readonly redactor: Redactor;
  private readonly clusters: Map<string, ClusterConfig>;

  constructor(private readonly options: TemporalServiceOptions) {
    this.cache = new TtlCache(options.config.cacheTtlMs);
    this.redactor = createRedactor({
      patterns: options.config.redaction.patterns,
      maxLength: options.config.redaction.maxTailLength,
    });
    this.clusters = new Map(options.config.clusters.map(c => [c.name, c]));
  }

  listClusters(): ClusterSummary[] {
    return [...this.clusters.values()].map(cluster => ({
      name: cluster.name,
      namespaces: cluster.namespaces,
      uiBaseUrl: cluster.uiBaseUrl,
    }));
  }

  /** Throws if the cluster or namespace is not in the configured allow-list. */
  assertAllowed(clusterName: string, namespace: string): ClusterConfig {
    const cluster = this.clusters.get(clusterName);
    if (!cluster) {
      throw new NotFoundError(`unknown cluster "${clusterName}"`);
    }
    if (!cluster.namespaces.includes(namespace)) {
      throw new NotFoundError(`namespace "${namespace}" is not enabled for cluster "${clusterName}"`);
    }
    return cluster;
  }

  async health(): Promise<ClusterHealth[]> {
    return Promise.all(
      [...this.clusters.values()].map(async cluster => {
        try {
          const connection = await this.connection(cluster);
          const info = await withTimeout(
            connection.workflowService.getSystemInfo({}),
            5000,
          );
          return {
            cluster: cluster.name,
            reachable: true,
            serverVersion: info.serverVersion ?? undefined,
          };
        } catch (error) {
          // Report the error class only: the message may echo the address or credentials.
          return {
            cluster: cluster.name,
            reachable: false,
            error: (error as Error).name || 'Error',
          };
        }
      }),
    );
  }

  /** Streams of a namespace: last run, last success, recent statuses and schedule. */
  async listStreams(clusterName: string, namespace: string): Promise<StreamSummary[]> {
    const cluster = this.assertAllowed(clusterName, namespace);
    return this.cache.getOrLoad(`streams:${clusterName}:${namespace}`, async () => {
      const client = await this.client(cluster, namespace);
      const runsByStream = new Map<string, RunSummary[]>();
      let scanned = 0;
      for await (const info of client.workflow.list({
        query: this.visibilityQuery(cluster),
      })) {
        const stream = streamNameOf(info.workflowId, cluster.streamPrefix);
        if (stream === undefined) {
          continue;
        }
        const runs = runsByStream.get(stream) ?? [];
        runs.push(toRunSummary(info.workflowId, info));
        runsByStream.set(stream, runs);
        if (++scanned >= MAX_STREAM_SCAN) {
          break; // bound the visibility scan; see README on large namespaces
        }
      }

      const schedules = await this.schedules(client, cluster);
      const names = new Set([...runsByStream.keys(), ...schedules.keys()]);
      return [...names].sort().map((name): StreamSummary => {
        const runs = (runsByStream.get(name) ?? []).sort(byStartDesc);
        return {
          name,
          schedule: schedules.get(name),
          lastRun: runs[0],
          lastSuccess: runs.find(run => run.status === 'COMPLETED'),
          recentStatuses: runs.slice(0, 10).map(run => run.status),
        };
      });
    });
  }

  /** Runs of one stream, newest first. */
  async listRuns(
    clusterName: string,
    namespace: string,
    stream: string,
    limit: number,
  ): Promise<RunSummary[]> {
    const cluster = this.assertAllowed(clusterName, namespace);
    const client = await this.client(cluster, namespace);
    const prefix = `${cluster.streamPrefix}${stream}`;
    const query = `${this.visibilityQuery(cluster)} AND WorkflowId STARTS_WITH "${escapeQuery(prefix)}"`;
    const runs: RunSummary[] = [];
    for await (const info of client.workflow.list({ query })) {
      if (streamNameOf(info.workflowId, cluster.streamPrefix) !== stream) {
        continue;
      }
      runs.push(toRunSummary(info.workflowId, info));
      if (runs.length >= limit) {
        break;
      }
    }
    return runs.sort(byStartDesc);
  }

  /**
   * One run: the definition it executed (from its workflow input), the state of
   * each stage, and the error. Task output and parameters are included only when
   * `includeOutput` is set (the caller checked `temporal.run.read`).
   */
  async getRun(
    clusterName: string,
    namespace: string,
    workflowId: string,
    includeOutput: boolean,
  ): Promise<RunDetail> {
    const cluster = this.assertAllowed(clusterName, namespace);
    const client = await this.client(cluster, namespace);
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();
    const { events } = await handle.fetchHistory();
    const history = events as HistoryEvent[];

    const raw = workflowInputOf(history);
    let graph: WorkflowGraph | undefined;
    try {
      graph = raw === undefined ? undefined : parseWorkflowDefinition(raw);
    } catch {
      graph = undefined; // unreadable definition: stages come from the history
    }

    const status = workflowStatusOf(description.status.name);
    const pending = (description.raw as { pendingActivities?: PendingActivity[] })
      .pendingActivities ?? [];
    const derived = deriveStages({
      stages: stageNamesOf(graph),
      optional: new Set(graph?.nodes.filter(n => n.optional).map(n => n.id)),
      gates: new Set(graph?.nodes.filter(n => n.gate).map(n => n.id)),
      history,
      pending,
      workflowStatus: status,
    });

    const stages = derived.stages.map(stage => ({
      ...stage,
      tail: includeOutput ? this.redactor.text(stage.tail) : undefined,
      error: this.redactor.text(stage.error),
    }));

    const summary = toRunSummary(workflowId, {
      status: description.status,
      startTime: description.startTime,
      closeTime: description.closeTime,
    });
    return {
      ...summary,
      stream: streamNameOf(workflowId, cluster.streamPrefix) ?? workflowId,
      // Parameters are a run-level detail: sent only with temporal.run.read, sensitive keys masked.
      graph: graph && sanitiseGraph(graph, this.redactor, includeOutput),
      stages,
      degraded: derived.degraded,
      uiUrl: uiUrlOf(cluster, namespace, workflowId, description.runId),
    };
  }

  /** Workflow executions in the namespace, from visibility. Not limited to stream workflows. */
  async listWorkflows(
    clusterName: string,
    namespace: string,
    query: WorkflowListQuery,
  ): Promise<WorkflowListResponse> {
    const cluster = this.assertAllowed(clusterName, namespace);
    const client = await this.client(cluster, namespace);
    const clauses: string[] = [];
    if (query.statuses.length > 0) {
      const names = query.statuses.map(status => `"${VISIBILITY_STATUS[status]}"`).join(', ');
      clauses.push(`ExecutionStatus IN (${names})`);
    }
    if (query.workflowType) {
      clauses.push(`WorkflowType = "${escapeQuery(query.workflowType)}"`);
    }
    if (query.startTime) {
      clauses.push(`StartTime >= "${new Date(query.startTime).toISOString()}"`);
    }
    const response = await client.workflowService.listWorkflowExecutions({
      namespace,
      pageSize: query.pageSize,
      nextPageToken: query.nextPageToken ? Buffer.from(query.nextPageToken, 'base64') : undefined,
      query: clauses.join(' AND '),
    });
    return {
      workflows: (response.executions ?? []).map(info => toWorkflowSummary(namespace, info)),
      nextPageToken: response.nextPageToken?.length
        ? Buffer.from(response.nextPageToken).toString('base64')
        : undefined,
    };
  }

  /**
   * One execution: summary, input, result and failure message. Input, result and
   * memo are sent only when `includePayloads` is set (the caller checked `temporal.run.read`).
   */
  async getWorkflow(
    clusterName: string,
    namespace: string,
    workflowId: string,
    runId: string,
    includePayloads: boolean,
  ): Promise<WorkflowExecutionDetail> {
    const cluster = this.assertAllowed(clusterName, namespace);
    const client = await this.client(cluster, namespace);
    const handle = client.workflow.getHandle(workflowId, runId);
    const description = await handle.describe();
    const history = ((await handle.fetchHistory()).events ?? []) as HistoryEvent[];
    const completed = history.find(event => event.workflowExecutionCompletedEventAttributes)
      ?.workflowExecutionCompletedEventAttributes;
    const failed = history.find(event => event.workflowExecutionFailedEventAttributes)
      ?.workflowExecutionFailedEventAttributes;
    // Copy through JSON so Dates become ISO strings. Not redacted: names like
    // CustomKeywordField would match SENSITIVE_KEY.
    const searchAttributes = JSON.parse(
      JSON.stringify(description.searchAttributes ?? {}),
    ) as Record<string, unknown>;
    const scheduled = Array.isArray(searchAttributes.TemporalScheduledById)
      ? searchAttributes.TemporalScheduledById[0]
      : undefined;

    return {
      ...toRunSummary(workflowId, {
        status: description.status,
        startTime: description.startTime,
        closeTime: description.closeTime,
      }),
      namespace,
      runId: description.runId,
      workflowType: description.type,
      taskQueue: description.taskQueue,
      scheduledBy: typeof scheduled === 'string' ? scheduled : undefined,
      historyLength: description.historyLength,
      searchAttributes,
      failure: this.redactor.text(failed?.failure?.message ?? undefined),
      input: includePayloads ? this.redactor.deep(workflowInputOf(history)) : undefined,
      result: includePayloads
        ? this.redactor.deep(decodeFirstPayload(completed?.result))
        : undefined,
      memo: includePayloads && description.memo
        ? (this.redactor.deep(description.memo) as Record<string, unknown>)
        : undefined,
      uiUrl: uiUrlOf(cluster, namespace, workflowId, description.runId),
    };
  }

  /** Event history of one run, capped at MAX_HISTORY_EVENTS. Payloads are decoded only with `includePayloads`. */
  async getHistory(
    clusterName: string,
    namespace: string,
    workflowId: string,
    runId: string,
    includePayloads: boolean,
  ): Promise<WorkflowHistoryResponse> {
    const cluster = this.assertAllowed(clusterName, namespace);
    const client = await this.client(cluster, namespace);
    const events = (await client.workflow.getHandle(workflowId, runId).fetchHistory()).events ?? [];
    return {
      events: events.slice(0, MAX_HISTORY_EVENTS).map((event): TemporalHistoryEvent => {
        const mapped = toHistoryEvent(event, includePayloads);
        return { ...mapped, attributes: this.redactor.deep(mapped.attributes) as Record<string, unknown> };
      }),
      truncated: events.length > MAX_HISTORY_EVENTS,
    };
  }

  /** A schedule's spec, policies and recent actions. Its action arguments are never sent. */
  async getSchedule(
    clusterName: string,
    namespace: string,
    scheduleId: string,
  ): Promise<ScheduleDetail> {
    const cluster = this.assertAllowed(clusterName, namespace);
    const client = await this.client(cluster, namespace);
    const description = await client.schedule.getHandle(scheduleId).describe();
    const { spec } = description;
    return {
      scheduleId: description.scheduleId,
      paused: description.state.paused,
      note: description.state.note,
      spec: {
        // The SDK compiles cron strings into calendars when describing a schedule.
        calendars: spec.calendars?.map(calendar => ({ ...calendar })),
        intervals: spec.intervals?.map(interval => ({
          every: `${interval.every}ms`,
          offset: interval.offset ? `${interval.offset}ms` : undefined,
        })),
        timezone: spec.timezone,
      },
      overlapPolicy: description.policies.overlap,
      workflowType: description.action.workflowType,
      recentActions: description.info.recentActions.map(action => ({
        scheduledAt: action.scheduledAt.toISOString(),
        takenAt: action.takenAt.toISOString(),
        workflowId: action.action.workflow.workflowId,
        runId: action.action.workflow.firstExecutionRunId,
      })),
      nextActionTimes: description.info.nextActionTimes.map(time => time.toISOString()),
    };
  }

  private visibilityQuery(cluster: ClusterConfig): string {
    const types = cluster.workflowTypes.map(type => `"${escapeQuery(type)}"`).join(', ');
    return `WorkflowType IN (${types}) AND WorkflowId STARTS_WITH "${escapeQuery(cluster.streamPrefix)}"`;
  }

  private async schedules(
    client: Client,
    cluster: ClusterConfig,
  ): Promise<Map<string, NonNullable<StreamSummary['schedule']>>> {
    const result = new Map<string, NonNullable<StreamSummary['schedule']>>();
    for await (const summary of client.schedule.list()) {
      if (!summary.scheduleId.startsWith(cluster.streamPrefix)) {
        continue;
      }
      const name = summary.scheduleId.slice(cluster.streamPrefix.length);
      const next = summary.info?.nextActionTimes?.[0];
      // The cron expression is in the run input (graph.meta.schedule), not in the schedule summary.
      result.set(name, {
        paused: summary.state?.paused ?? false,
        nextRunTime: next ? new Date(next).toISOString() : undefined,
      });
    }
    return result;
  }

  private connection(cluster: ClusterConfig): Promise<Connection> {
    let connection = this.connections.get(cluster.name);
    if (!connection) {
      const connect = this.options.connect ?? defaultConnect;
      connection = connect(cluster).catch(error => {
        this.connections.delete(cluster.name); // allow a retry on the next request
        throw error;
      });
      this.connections.set(cluster.name, connection);
    }
    return connection;
  }

  private async client(cluster: ClusterConfig, namespace: string): Promise<Client> {
    const key = `${cluster.name}/${namespace}`;
    let client = this.clients.get(key);
    if (!client) {
      client = new Client({ connection: await this.connection(cluster), namespace });
      this.clients.set(key, client);
    }
    return client;
  }
}

export function streamNameOf(workflowId: string, prefix: string): string | undefined {
  if (!workflowId.startsWith(prefix)) {
    return undefined;
  }
  // Manual runs: <prefix><name>/<compact timestamp>. Schedule runs: <prefix><name>-<RFC 3339 UTC>.
  // Names may contain dashes, so only the known suffixes are removed.
  const rest = workflowId.slice(prefix.length);
  const slash = rest.indexOf('/');
  const name = (slash === -1 ? rest : rest.slice(0, slash)).replace(SCHEDULE_SUFFIX, '');
  return name === '' ? undefined : name;
}

function toRunSummary(
  workflowId: string,
  info: { status: { name?: string }; startTime: Date; closeTime?: Date | null },
): RunSummary {
  const start = new Date(info.startTime);
  const end = info.closeTime ? new Date(info.closeTime) : undefined;
  return {
    workflowId,
    status: workflowStatusOf(info.status.name) as RunStatus,
    startTime: start.toISOString(),
    closeTime: end?.toISOString(),
    durationSeconds: Math.round(((end ?? new Date()).getTime() - start.getTime()) / 1000),
  };
}

function toWorkflowSummary(namespace: string, info: RawWorkflowExecutionInfo): TemporalWorkflowSummary {
  const run = toRunSummary(info.execution?.workflowId ?? '', {
    status: { name: STATUS_BY_CODE[info.status ?? 0] },
    startTime: timestampDate(info.startTime ?? {}),
    closeTime: info.closeTime ? timestampDate(info.closeTime) : undefined,
  });
  const scheduled = info.searchAttributes?.indexedFields?.TemporalScheduledById;
  const scheduledBy = decodeFirstPayload({ payloads: [scheduled ?? null] });
  return {
    ...run,
    namespace,
    runId: info.execution?.runId ?? '',
    workflowType: info.type?.name ?? '',
    taskQueue: info.taskQueue ?? '',
    scheduledBy: typeof scheduledBy === 'string' ? scheduledBy : undefined,
  };
}

function uiUrlOf(
  cluster: ClusterConfig,
  namespace: string,
  workflowId: string,
  runId: string,
): string | undefined {
  return cluster.uiBaseUrl
    ? `${cluster.uiBaseUrl.replace(/\/$/, '')}/namespaces/${namespace}/workflows/${workflowId}/${runId}/history`
    : undefined;
}

function byStartDesc(a: RunSummary, b: RunSummary) {
  return b.startTime.localeCompare(a.startTime);
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sanitiseGraph(
  graph: WorkflowGraph,
  redactor: Redactor,
  includeParams: boolean,
): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(node => ({
      ...node,
      params: includeParams ? redactor.params(node.params) : undefined,
    })),
  };
}

async function defaultConnect(cluster: ClusterConfig): Promise<Connection> {
  return Connection.connect({
    address: cluster.address,
    tls: cluster.tls
      ? {
          serverNameOverride: cluster.tlsServerName,
          serverRootCACertificate: cluster.tlsCaData
            ? Buffer.from(cluster.tlsCaData, 'utf8')
            : undefined,
        }
      : undefined,
    apiKey: cluster.apiKey,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
