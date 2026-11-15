/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TemporalHistoryEvent } from '@acarmisc/backstage-plugin-temporal-common';
import { buildHistoryGraph } from './historyGraph';

const ev = (eventId: number, eventType: string, attributes: Record<string, unknown> = {}): TemporalHistoryEvent => ({
  eventId,
  eventTime: '2026-01-01T00:00:00Z',
  eventType,
  attributes,
});

describe('buildHistoryGraph', () => {
  it('draws one activity node per scheduled activity, chained in order', () => {
    const { graph } = buildHistoryGraph([
      ev(1, 'WorkflowExecutionStarted'),
      ev(5, 'ActivityTaskScheduled', { activityId: 'a1', activityType: { name: 'fetch' } }),
      ev(9, 'ActivityTaskScheduled', { activityId: 'a2', activityType: { name: 'publish' } }),
    ]);
    expect(graph.nodes.map(n => [n.label, n.kind])).toEqual([
      ['fetch', 'activity'],
      ['publish', 'activity'],
    ]);
    expect(graph.edges).toEqual([{ from: 'activity-a1', to: 'activity-a2' }]);
  });

  it('colours each activity by the event that closes it', () => {
    const { states } = buildHistoryGraph([
      ev(5, 'ActivityTaskScheduled', { activityId: 'ok', activityType: { name: 'a' } }),
      ev(6, 'ActivityTaskStarted', { scheduledEventId: 5 }),
      ev(7, 'ActivityTaskCompleted', { scheduledEventId: 5 }),
      ev(8, 'ActivityTaskScheduled', { activityId: 'bad', activityType: { name: 'b' } }),
      ev(9, 'ActivityTaskStarted', { scheduledEventId: 8 }),
      ev(10, 'ActivityTaskFailed', { scheduledEventId: 8 }),
      ev(11, 'ActivityTaskScheduled', { activityId: 'run', activityType: { name: 'c' } }),
      ev(12, 'ActivityTaskStarted', { scheduledEventId: 11 }),
      ev(13, 'ActivityTaskScheduled', { activityId: 'wait', activityType: { name: 'd' } }),
    ]);
    expect(states).toEqual({
      'activity-ok': 'ok',
      'activity-bad': 'failed',
      'activity-run': 'running',
      'activity-wait': 'pending',
    });
  });

  it('adds child workflows and timers as nodes', () => {
    const { graph, states } = buildHistoryGraph([
      ev(3, 'ChildWorkflowExecutionInitiated', { workflowType: { name: 'child' } }),
      ev(4, 'ChildWorkflowExecutionStarted', { initiatedEventId: 3 }),
      ev(5, 'TimerStarted', { timerId: 't1' }),
      ev(6, 'TimerFired', { startedEventId: 5 }),
    ]);
    expect(graph.nodes.map(n => n.kind)).toEqual(['child', 'timer']);
    expect(states).toEqual({ 'child-3': 'running', 'timer-5': 'ok' });
  });

  it('has no nodes for a history without activities, children or timers', () => {
    expect(buildHistoryGraph([ev(1, 'WorkflowExecutionStarted')]).graph.nodes).toEqual([]);
  });
});
