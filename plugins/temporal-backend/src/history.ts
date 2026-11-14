/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import type {
  RunStatus,
  StageRunState,
  StageState,
  WorkflowGraph,
} from '@acarmisc/backstage-plugin-temporal-common';

// Minimal structural view of Temporal history events. Kept loose so the
// derivation is testable without the SDK's protobuf classes.
export interface Payloads {
  payloads?: ReadonlyArray<{ data?: Uint8Array | string | null } | null> | null;
}

export interface HistoryEvent {
  eventId?: unknown;
  activityTaskScheduledEventAttributes?: {
    activityId?: string;
    input?: Payloads | null;
  } | null;
  activityTaskStartedEventAttributes?: { scheduledEventId?: unknown } | null;
  activityTaskCompletedEventAttributes?: {
    scheduledEventId?: unknown;
    result?: Payloads | null;
  } | null;
  activityTaskFailedEventAttributes?: {
    scheduledEventId?: unknown;
    failure?: { message?: string | null } | null;
  } | null;
  activityTaskTimedOutEventAttributes?: {
    scheduledEventId?: unknown;
    failure?: { message?: string | null } | null;
  } | null;
}

/** A pending activity attempt, from DescribeWorkflowExecution. */
export interface PendingActivity {
  activityId?: string;
  attempt?: number;
  lastFailure?: { message?: string | null } | null;
}

/** What a kbflow activity returns: `{stage, status, exit, seconds, tail}`. */
interface ActivityResult {
  status?: string;
  exit?: number | null;
  seconds?: number;
  tail?: string;
}

/** Reads the first payload as JSON. Undefined when it is missing or not JSON. */
export function decodeFirstPayload(payloads: Payloads | null | undefined): unknown {
  const data = payloads?.payloads?.[0]?.data;
  if (data === undefined || data === null) {
    return undefined;
  }
  const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Temporal event ids are Longs or numbers: compare them as strings.
const idOf = (value: unknown) => String(value);

function stageNameOf(input: Payloads | null | undefined): string | undefined {
  const stage = decodeFirstPayload(input) as { name?: unknown } | undefined;
  return typeof stage?.name === 'string' ? stage.name : undefined;
}

export function workflowStatusOf(name: string | undefined): RunStatus {
  switch (name) {
    case 'RUNNING':
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELED':
    case 'TERMINATED':
    case 'CONTINUED_AS_NEW':
    case 'TIMED_OUT':
      return name;
    default:
      return 'UNKNOWN';
  }
}

export interface DeriveInput {
  /** Stage names in declaration order. Used only by the positional fallback. */
  stages: string[];
  /** Stages that may fail without stopping the run (graph `optional`). */
  optional?: ReadonlySet<string>;
  /** Stages that wait for an approval signal before running (graph `gate`). */
  gates?: ReadonlySet<string>;
  history: HistoryEvent[];
  pending?: PendingActivity[];
  workflowStatus: RunStatus;
}

interface Attempt {
  stage: string;
  scheduledId: string;
  activityId?: string;
  started: boolean;
  result?: ActivityResult;
  failure?: string;
}

const FINISHED: RunStatus[] = ['COMPLETED', 'FAILED', 'CANCELED', 'TERMINATED', 'TIMED_OUT'];

/**
 * Derives the state of every stage from the history of a run.
 *
 * Activities are matched to stages by the stage name in their input
 * (`input[0].name`), never by position, because a DAG runs activities in a
 * different order from the stage list. Position is used only when the payloads
 * are not readable JSON (a custom data converter); the result then carries
 * `degraded: 'positional-association'`.
 */
export function deriveStages(input: DeriveInput): {
  stages: StageRunState[];
  degraded?: 'positional-association';
} {
  // Pass 1: one attempt per ActivityTaskScheduled, named by its stage.
  const scheduled: Array<{
    scheduledId: string;
    activityId?: string;
    stage?: string;
  }> = [];
  for (const event of input.history) {
    const attrs = event.activityTaskScheduledEventAttributes;
    if (attrs) {
      scheduled.push({
        scheduledId: idOf(event.eventId),
        activityId: attrs.activityId,
        stage: stageNameOf(attrs.input),
      });
    }
  }

  let degraded: 'positional-association' | undefined;
  const attempts = new Map<string, Attempt>();
  scheduled.forEach((entry, index) => {
    let stage = entry.stage;
    if (stage === undefined) {
      degraded = 'positional-association';
      stage = input.stages[index];
    }
    if (stage !== undefined) {
      attempts.set(entry.scheduledId, {
        stage,
        scheduledId: entry.scheduledId,
        activityId: entry.activityId,
        started: false,
      });
    }
  });

  // Pass 2: outcomes, linked to their ActivityTaskScheduled event.
  for (const event of input.history) {
    const started = event.activityTaskStartedEventAttributes;
    const completed = event.activityTaskCompletedEventAttributes;
    const failed = event.activityTaskFailedEventAttributes;
    const timedOut = event.activityTaskTimedOutEventAttributes;
    const outcome = started ?? completed ?? failed ?? timedOut;
    const attempt = outcome && attempts.get(idOf(outcome.scheduledEventId));
    if (!attempt) {
      continue;
    }
    if (started) {
      attempt.started = true;
    } else if (completed) {
      attempt.result = decodeFirstPayload(completed.result) as ActivityResult | undefined;
    } else {
      const message = (failed ?? timedOut)?.failure?.message;
      attempt.failure = message ?? (timedOut ? 'timed out' : 'failed');
    }
  }

  // A stage runs once per workflow; keep the latest attempt if there are several.
  const latest = new Map<string, Attempt>();
  for (const attempt of attempts.values()) {
    const current = latest.get(attempt.stage);
    if (!current || Number(attempt.scheduledId) > Number(current.scheduledId)) {
      latest.set(attempt.stage, attempt);
    }
  }

  const pendingByActivity = new Map<string, PendingActivity>();
  for (const pending of input.pending ?? []) {
    if (pending.activityId) {
      pendingByActivity.set(pending.activityId, pending);
    }
  }

  const finished = FINISHED.includes(input.workflowStatus);
  const stages = input.stages.map((stage): StageRunState => {
    const attempt = latest.get(stage);
    const pending = attempt?.activityId
      ? pendingByActivity.get(attempt.activityId)
      : undefined;
    const base = {
      stage,
      optional: input.optional?.has(stage) ?? false,
    };

    if (attempt?.result) {
      return {
        ...base,
        state: attempt.result.status === 'warn' ? 'warn' : 'ok',
        exit: attempt.result.exit,
        seconds: attempt.result.seconds,
        tail: attempt.result.tail,
      };
    }
    if (attempt?.failure !== undefined) {
      return { ...base, state: 'failed', error: attempt.failure };
    }
    if (attempt && pending && (pending.attempt ?? 1) > 1) {
      return {
        ...base,
        state: 'retrying',
        attempt: pending.attempt,
        error: pending.lastFailure?.message ?? undefined,
      };
    }
    if (attempt) {
      return { ...base, state: 'running', attempt: pending?.attempt };
    }
    const state: StageState =
      !finished && input.gates?.has(stage) ? 'waiting-approval' : 'pending';
    return { ...base, state };
  });

  return { stages, degraded };
}

/** Stage names of a graph, in declaration order. */
export function stageNamesOf(graph: WorkflowGraph | undefined): string[] {
  return graph?.nodes.map(node => node.id) ?? [];
}
