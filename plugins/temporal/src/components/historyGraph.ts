/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  StageState,
  TemporalHistoryEvent,
  WorkflowGraph,
  WorkflowNode,
} from '@acarmisc/backstage-plugin-temporal-common';

export interface HistoryGraph {
  graph: WorkflowGraph;
  /** State per node id, for WorkflowDiagram. */
  states: Record<string, StageState>;
}

const OK = new Set(['ActivityTaskCompleted', 'ChildWorkflowExecutionCompleted', 'TimerFired']);
const FAILED = new Set([
  'ActivityTaskFailed',
  'ActivityTaskTimedOut',
  'ChildWorkflowExecutionFailed',
  'ChildWorkflowExecutionTimedOut',
]);
const WARN = new Set([
  'ActivityTaskCanceled',
  'ChildWorkflowExecutionCanceled',
  'ChildWorkflowExecutionTerminated',
  'TimerCanceled',
]);
const STARTED = new Set(['ActivityTaskStarted', 'ChildWorkflowExecutionStarted']);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
const typeName = (value: unknown): string | undefined =>
  typeof value === 'object' && value !== null && 'name' in value ? text(value.name) : undefined;

/** The node an event opens, or undefined for events that do not start a unit of work. */
function nodeOpenedBy(event: TemporalHistoryEvent): WorkflowNode | undefined {
  const a = event.attributes;
  switch (event.eventType) {
    case 'ActivityTaskScheduled': {
      // Prefixed by kind so an activity id can never collide with an event id of another node.
      const activityId = text(a.activityId) ?? String(event.eventId);
      return {
        id: `activity-${activityId}`,
        kind: 'activity',
        label: typeName(a.activityType) ?? 'activity',
        detail: text(a.activityId) && `#${a.activityId}`,
      };
    }
    case 'ChildWorkflowExecutionInitiated':
      return { id: `child-${event.eventId}`, kind: 'child', label: typeName(a.workflowType) ?? 'child workflow' };
    case 'TimerStarted':
      return { id: `timer-${event.eventId}`, kind: 'timer', label: 'timer', detail: text(a.timerId) };
    default:
      return undefined;
  }
}

function stateOf(node: WorkflowNode, later: string[]): StageState {
  if (later.some(type => OK.has(type))) return 'ok';
  if (later.some(type => FAILED.has(type))) return 'failed';
  if (later.some(type => WARN.has(type))) return 'warn';
  // A timer has no "started" event of its own: it is running until it fires.
  if (node.kind === 'timer' || later.some(type => STARTED.has(type))) return 'running';
  return 'pending';
}

/**
 * Turns a workflow history into a sequential graph of its activities, child
 * workflows and timers. Sequential because history order is the only order
 * the events give us; parallel branches show as a chain.
 */
export function buildHistoryGraph(events: TemporalHistoryEvent[]): HistoryGraph {
  const nodes: WorkflowNode[] = [];
  const nodeOpenedAt = new Map<string, string>(); // opening event id -> node id
  for (const event of events) {
    const node = nodeOpenedBy(event);
    if (node) {
      nodes.push(node);
      nodeOpenedAt.set(String(event.eventId), node.id);
    }
  }

  // Later events point back at the event that opened them.
  const later = new Map<string, string[]>();
  for (const event of events) {
    const a = event.attributes;
    const ref = text(a.scheduledEventId ?? a.initiatedEventId ?? a.startedEventId);
    const id = ref === undefined ? undefined : nodeOpenedAt.get(ref);
    if (id) later.set(id, [...(later.get(id) ?? []), event.eventType]);
  }

  const states: Record<string, StageState> = {};
  for (const node of nodes) states[node.id] = stateOf(node, later.get(node.id) ?? []);

  const edges = nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id }));
  return { graph: { id: 'history', name: 'history', nodes, edges }, states };
}
