/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { deriveStages, HistoryEvent, Payloads } from './history';

const json = (value: unknown): Payloads => ({
  payloads: [{ data: Buffer.from(JSON.stringify(value)) }],
});

// Activity input is [stage, ctx]; only the stage name matters here.
const scheduled = (eventId: number, activityId: string, stage: string): HistoryEvent => ({
  eventId,
  activityTaskScheduledEventAttributes: {
    activityId,
    input: { payloads: [json({ name: stage }).payloads![0], json({ stream: 's' }).payloads![0]] },
  },
});

const started = (eventId: number, scheduledEventId: number): HistoryEvent => ({
  eventId,
  activityTaskStartedEventAttributes: { scheduledEventId },
});

const completed = (eventId: number, scheduledEventId: number, result: unknown): HistoryEvent => ({
  eventId,
  activityTaskCompletedEventAttributes: { scheduledEventId, result: json(result) },
});

const failed = (eventId: number, scheduledEventId: number, message: string): HistoryEvent => ({
  eventId,
  activityTaskFailedEventAttributes: { scheduledEventId, failure: { message } },
});

const stateOf = (result: ReturnType<typeof deriveStages>, stage: string) =>
  result.stages.find(s => s.stage === stage);

describe('deriveStages', () => {
  it('maps a finished linear run to ok, warn and failed by stage name', () => {
    const result = deriveStages({
      stages: ['clone', 'validate', 'publish'],
      optional: new Set(['publish']),
      workflowStatus: 'COMPLETED',
      history: [
        scheduled(5, '5', 'clone'),
        started(6, 5),
        completed(7, 5, { stage: 'clone', status: 'ok', exit: 0, seconds: 3, tail: 'done' }),
        scheduled(8, '8', 'validate'),
        started(9, 8),
        completed(10, 8, { stage: 'validate', status: 'warn', exit: 2, seconds: 9 }),
        scheduled(11, '11', 'publish'),
        started(12, 11),
        failed(13, 11, 'upload refused'),
      ],
    });

    expect(stateOf(result, 'clone')).toMatchObject({ state: 'ok', exit: 0, seconds: 3, tail: 'done' });
    expect(stateOf(result, 'validate')).toMatchObject({ state: 'warn', exit: 2 });
    expect(stateOf(result, 'publish')).toMatchObject({
      state: 'failed',
      error: 'upload refused',
      optional: true,
    });
    expect(result.degraded).toBeUndefined();
  });

  it('associates activities by name when a DAG runs them out of list order', () => {
    // List order: jira, confluence, qualify. Activities start in another order.
    const result = deriveStages({
      stages: ['jira', 'confluence', 'qualify'],
      workflowStatus: 'RUNNING',
      history: [
        scheduled(5, '5', 'confluence'),
        scheduled(8, '8', 'jira'),
        completed(10, 5, { status: 'ok' }),
        started(9, 8),
      ],
    });
    expect(stateOf(result, 'confluence')?.state).toBe('ok');
    expect(stateOf(result, 'jira')?.state).toBe('running');
    expect(stateOf(result, 'qualify')?.state).toBe('pending');
  });

  it('marks a stage retrying when its pending attempt is above 1', () => {
    const result = deriveStages({
      stages: ['fetch'],
      workflowStatus: 'RUNNING',
      history: [scheduled(5, 'act-5', 'fetch'), started(6, 5)],
      pending: [{ activityId: 'act-5', attempt: 2, lastFailure: { message: 'connection reset' } }],
    });
    expect(stateOf(result, 'fetch')).toMatchObject({
      state: 'retrying',
      attempt: 2,
      error: 'connection reset',
    });
  });

  it('shows waiting-approval only while the run is still open', () => {
    const base = { stages: ['build', 'release'], gates: new Set(['release']), history: [] };
    const open = deriveStages({ ...base, workflowStatus: 'RUNNING' });
    const closed = deriveStages({ ...base, workflowStatus: 'COMPLETED' });
    expect(stateOf(open, 'release')?.state).toBe('waiting-approval');
    expect(stateOf(closed, 'release')?.state).toBe('pending');
  });

  it('falls back to position, and says so, when payloads are not JSON', () => {
    const opaque: HistoryEvent = {
      eventId: 5,
      activityTaskScheduledEventAttributes: {
        activityId: '5',
        input: { payloads: [{ data: Buffer.from([0x00, 0xff, 0x12]) }] },
      },
    };
    const result = deriveStages({
      stages: ['clone', 'validate'],
      workflowStatus: 'RUNNING',
      history: [opaque, completed(7, 5, { status: 'ok' })],
    });
    expect(result.degraded).toBe('positional-association');
    expect(stateOf(result, 'clone')?.state).toBe('ok');
  });

  it('reads Temporal event ids given as Long-like objects', () => {
    const longLike = { toString: () => '5' };
    const result = deriveStages({
      stages: ['a'],
      workflowStatus: 'COMPLETED',
      history: [
        { eventId: longLike, activityTaskScheduledEventAttributes: { activityId: '5', input: json({ name: 'a' }) } },
        { eventId: 6, activityTaskCompletedEventAttributes: { scheduledEventId: { toString: () => '5' }, result: json({ status: 'ok' }) } },
      ],
    });
    expect(stateOf(result, 'a')?.state).toBe('ok');
  });
});
