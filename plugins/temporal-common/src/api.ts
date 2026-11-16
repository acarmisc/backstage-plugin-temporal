/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowGraph } from './graph';

/** State of one stage of a run, as shown in a diagram overlay. */
export type StageState =
  | 'pending'
  | 'running'
  | 'ok'
  | 'warn'
  | 'failed'
  | 'retrying'
  | 'waiting-approval';

/** Status of the Temporal workflow execution itself. */
export type RunStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'TERMINATED'
  | 'CONTINUED_AS_NEW'
  | 'TIMED_OUT'
  | 'UNKNOWN';

export interface StageRunState {
  stage: string;
  state: StageState;
  /** Activity attempt number, when known. */
  attempt?: number;
  exit?: number | null;
  seconds?: number;
  /** Output tail, truncated and redacted by the backend. Only sent with `temporal.run.read`. */
  tail?: string;
  /** Failure message, truncated and redacted by the backend. */
  error?: string;
  optional?: boolean;
}

export interface RunSummary {
  workflowId: string;
  status: RunStatus;
  startTime: string;
  closeTime?: string;
  durationSeconds?: number;
}

export interface RunDetail extends RunSummary {
  stream: string;
  /** Definition executed by this run, read from the workflow input. */
  graph?: WorkflowGraph;
  stages: StageRunState[];
  /**
   * Set when stage association had to fall back to position because the
   * payloads were not readable JSON. See README, "Data converters".
   */
  degraded?: 'positional-association';
  uiUrl?: string;
}

export interface StreamSummary {
  name: string;
  /** Cron is shown on the run detail; the list only knows the schedule state. */
  schedule?: { cron?: string; paused: boolean; nextRunTime?: string };
  lastRun?: RunSummary;
  lastSuccess?: RunSummary;
  /** Statuses of the most recent runs, newest first. */
  recentStatuses: RunStatus[];
}

export interface ClusterSummary {
  name: string;
  namespaces: string[];
  uiBaseUrl?: string;
}

export interface ClusterHealth {
  cluster: string;
  reachable: boolean;
  serverVersion?: string;
  error?: string;
}

/** One workflow execution in the workflow browser list. */
export interface TemporalWorkflowSummary {
  namespace: string;
  workflowId: string;
  runId: string;
  workflowType: string;
  taskQueue: string;
  status: RunStatus;
  startTime: string;
  closeTime?: string;
  durationSeconds?: number;
  /** Schedule id, from the `TemporalScheduledById` search attribute. */
  scheduledBy?: string;
}

export interface WorkflowListResponse {
  workflows: TemporalWorkflowSummary[];
  /** Opaque (base64); pass back to get the next page. Absent on the last page. */
  nextPageToken?: string;
}

export interface WorkflowExecutionDetail extends TemporalWorkflowSummary {
  historyLength?: number;
  memo?: Record<string, unknown>;
  searchAttributes?: Record<string, unknown>;
  /** Decoded workflow input/result. Only sent with `temporal.run.read`, sensitive keys masked. */
  input?: unknown;
  result?: unknown;
  /** Failure message, redacted. */
  failure?: string;
  uiUrl?: string;
}

export interface TemporalHistoryEvent {
  eventId: number;
  eventTime: string;
  /** e.g. `WorkflowExecutionStarted`, `ActivityTaskScheduled`. */
  eventType: string;
  /** Raw event attributes. Payloads are decoded only with `temporal.run.read`. */
  attributes: Record<string, unknown>;
}

export interface WorkflowHistoryResponse {
  events: TemporalHistoryEvent[];
  /** True when the history was longer than the backend's event cap. */
  truncated: boolean;
}

export interface ScheduleSpecView {
  cronExpressions?: string[];
  calendars?: Record<string, unknown>[];
  intervals?: { every: string; offset?: string }[];
  timezone?: string;
}

/** One row of `GET /schedules`. Action arguments are never included. */
export interface ScheduleListItem {
  scheduleId: string;
  paused: boolean;
  note?: string;
  workflowType?: string;
  spec: ScheduleSpecView;
  /** Upcoming action times, ISO, soonest first. */
  nextActionTimes: string[];
  /** When the most recent action was taken. */
  lastActionAt?: string;
  /** Newest workflow started by this schedule, when visibility knows it. */
  lastRun?: { workflowId: string; runId: string; status: RunStatus; startTime: string };
}

export interface ScheduleListResponse {
  schedules: ScheduleListItem[];
}

export interface ScheduleDetail {
  scheduleId: string;
  paused: boolean;
  note?: string;
  spec: ScheduleSpecView;
  overlapPolicy?: string;
  workflowType?: string;
  recentActions: { scheduledAt: string; takenAt: string; workflowId?: string; runId?: string }[];
  nextActionTimes: string[];
}
