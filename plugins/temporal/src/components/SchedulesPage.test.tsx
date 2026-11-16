/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ClusterSummary, ScheduleListResponse } from '@acarmisc/backstage-plugin-temporal-common';

const get = jest.fn();
const api = { get };
jest.mock('../api', () => ({ useTemporalApi: () => api }));
jest.mock('@backstage/core-components', () => ({
  Page: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
  Header: ({ title }: { title?: string }) => <h1>{title}</h1>,
  Content: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
}));

import { cadenceText, relativeTime } from './format';
import { SchedulesPage } from './SchedulesPage';

const clusters: ClusterSummary[] = [{ name: 'temporal', namespaces: ['default'] }];
const soon = new Date(Date.now() + 3 * 3600e3).toISOString();
const list: ScheduleListResponse = {
  schedules: [
    {
      scheduleId: 'nightly-sync',
      paused: false,
      workflowType: 'SyncWorkflow',
      spec: { intervals: [{ every: '3600000ms' }] },
      nextActionTimes: [soon],
      lastRun: { workflowId: 'nightly-sync-1', runId: 'r1', status: 'FAILED', startTime: new Date().toISOString() },
    },
    { scheduleId: 'old-report', paused: true, spec: {}, nextActionTimes: [] },
  ],
};

describe('SchedulesPage', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((path: string) => Promise.resolve(path === '/clusters' ? clusters : list));
    window.history.replaceState(null, '', '/temporal/schedules');
  });

  it('renders a card per schedule linking to its detail', async () => {
    render(<SchedulesPage />);

    const card = (await screen.findByText('nightly-sync')).closest('a')!;
    expect(card).toHaveAttribute('href', '/temporal/schedule?cluster=temporal&namespace=default&scheduleId=nightly-sync');
    expect(card).toHaveTextContent('Every hour');
    expect(card).toHaveTextContent('in 3h');
    expect(card).toHaveTextContent('FAILED');
    expect(screen.getByText('old-report')).toBeInTheDocument();
  });

  it('filters paused schedules and keeps the filter in the URL', async () => {
    render(<SchedulesPage />);
    await screen.findByText('nightly-sync');

    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'paused' } });

    expect(screen.queryByText('nightly-sync')).not.toBeInTheDocument();
    expect(screen.getByText('old-report')).toBeInTheDocument();
    expect(window.location.search).toContain('state=paused');
  });

  it('describes cadences in words', () => {
    const range = (start: number, end = start) => [{ start, end, step: 1 }];
    expect(cadenceText({ calendars: [{ minute: range(0), hour: range(3), dayOfWeek: range(0, 6) }] })).toBe('Daily at 03:00');
    expect(cadenceText({ calendars: [{ minute: range(30), hour: range(9), dayOfWeek: [{ start: 1, end: 1, step: 1 }, { start: 3, end: 3, step: 1 }] }] })).toBe('Mon, Wed at 09:30');
    expect(cadenceText({ intervals: [{ every: '900000ms' }], timezone: 'UTC' })).toBe('Every 15 minutes (UTC)');
    expect(relativeTime(new Date(Date.now() - 2 * 3600e3).toISOString())).toBe('2h ago');
  });
});
