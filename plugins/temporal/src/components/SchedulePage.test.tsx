/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import type { ScheduleDetail } from '@acarmisc/backstage-plugin-temporal-common';

const get = jest.fn();
const api = { get };
jest.mock('../api', () => ({ useTemporalApi: () => api }));
jest.mock('@backstage/core-components', () => ({
  Page: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
  Header: ({ title }: { title?: string }) => <h1>{title}</h1>,
  Content: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
}));

import { SchedulePage } from './SchedulePage';

const detail: ScheduleDetail = {
  scheduleId: 'nightly-sync',
  paused: false,
  spec: { intervals: [{ every: '3600000ms' }] },
  overlapPolicy: 'SKIP',
  workflowType: 'SyncWorkflow',
  recentActions: [{ scheduledAt: '2026-01-01T00:00:00Z', takenAt: '2026-01-01T00:00:01Z', workflowId: 'nightly-sync-1', runId: 'r1' }],
  nextActionTimes: Array.from({ length: 7 }, (_, i) => new Date(Date.now() + (i + 1) * 3600e3).toISOString()),
};

it('shows policy, five upcoming runs and links recent actions to the workflow', async () => {
  get.mockResolvedValue(detail);
  window.history.replaceState(null, '', '/temporal/schedule?cluster=temporal&namespace=default&scheduleId=nightly-sync');
  render(<SchedulePage />);

  expect(await screen.findByText('SKIP')).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith('/schedules/nightly-sync', { cluster: 'temporal', namespace: 'default' });
  expect(screen.getByRole('link', { name: 'nightly-sync-1' })).toHaveAttribute(
    'href',
    '/temporal/workflow?cluster=temporal&namespace=default&workflowId=nightly-sync-1&runId=r1',
  );
  expect(screen.getByText('Next runs').parentElement!.querySelectorAll('li')).toHaveLength(5);
});
