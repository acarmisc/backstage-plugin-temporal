/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import type { ClusterSummary, ScheduleListResponse } from '@acarmisc/backstage-plugin-temporal-common';

const get = jest.fn();
const mockOwners = new Map<string, { ownerRef: string; entityRef: string }>();
const api = { get };
jest.mock('./owners', () => ({
  ...jest.requireActual('./owners'),
  useStreamOwners: () => mockOwners,
}));
jest.mock('../api', () => ({ useTemporalApi: () => api }));

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
    await renderInTestApp(<SchedulesPage />);

    const card = (await screen.findByText('nightly-sync')).closest('a')!;
    expect(card).toHaveAttribute('href', '/temporal/schedule?cluster=temporal&namespace=default&scheduleId=nightly-sync');
    expect(card).toHaveTextContent('Every hour');
    expect(card).toHaveTextContent('in 3h');
    expect(card).toHaveTextContent('FAILED');
    expect(screen.getByText('old-report')).toBeInTheDocument();
  });

  it('shows the owner on matching schedules only', async () => {
    mockOwners.set('nightly-sync', { ownerRef: 'group:default/team-a', entityRef: 'component:default/sync' });
    await renderInTestApp(<SchedulesPage />);
    const card = (await screen.findByText('nightly-sync')).closest('a')!;
    expect(card).toHaveTextContent('Owner: team-a');
    expect(screen.getByText('old-report').closest('a')).toHaveTextContent('Owner: —');
    mockOwners.clear();
  });

  it('filters paused schedules and keeps the filter in the URL', async () => {
    await renderInTestApp(<SchedulesPage />);
    await screen.findByText('nightly-sync');

    fireEvent.mouseDown(screen.getByRole('button', { name: /All/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Paused' }));

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
