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
