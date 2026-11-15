/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ClusterSummary, WorkflowListResponse } from '@acarmisc/backstage-plugin-temporal-common';

const get = jest.fn();
// Stable identity: the real `useTemporalApi` is memoized, a fresh object per
// render would retrigger every `useLoad` forever.
const api = { get };
jest.mock('../api', () => ({ useTemporalApi: () => api }));
// The real Page/Header need a MUI theme; this test only cares about the requests.
jest.mock('@backstage/core-components', () => ({
  Page: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
  Header: ({ title }: { title?: string }) => <h1>{title}</h1>,
  Content: ({ children }: { children?: unknown }) => <div>{children as never}</div>,
}));

import { formatDuration } from './format';
import { WorkflowsPage } from './WorkflowsPage';

const clusters: ClusterSummary[] = [
  { name: 'temporal', namespaces: ['default'], uiBaseUrl: 'https://ui.example' },
];
const list: WorkflowListResponse = {
  workflows: [
    {
      namespace: 'default',
      workflowId: 'order-42',
      runId: '0f1e2d3c-aaaa-bbbb-cccc-ddddeeeeffff',
      workflowType: 'OrderWorkflow',
      taskQueue: 'orders',
      status: 'COMPLETED',
      startTime: '2026-01-01T10:00:00Z',
      durationSeconds: 184,
    },
  ],
};

describe('WorkflowsPage', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((path: string) =>
      Promise.resolve(path === '/clusters' ? clusters : list),
    );
    window.history.replaceState(null, '', '/temporal/workflows');
  });

  it('renders a row linking to the workflow detail', async () => {
    render(<WorkflowsPage />);

    const link = await screen.findByRole('link', { name: 'order-42' });
    expect(link).toHaveAttribute(
      'href',
      '/temporal/workflow?cluster=temporal&namespace=default&workflowId=order-42&runId=0f1e2d3c-aaaa-bbbb-cccc-ddddeeeeffff',
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('COMPLETED')).toBeInTheDocument();
    expect(within(table).getByText('3m 4s')).toBeInTheDocument();
  });

  it('filters by status and keeps the filter in the URL', async () => {
    render(<WorkflowsPage />);
    await screen.findByRole('link', { name: 'order-42' });

    fireEvent.click(screen.getByRole('checkbox', { name: /FAILED/ }));

    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith(
        '/workflows',
        expect.objectContaining({ cluster: 'temporal', namespace: 'default', status: 'FAILED' }),
      ),
    );
    expect(window.location.search).toContain('status=FAILED');
  });

  it('formats durations as the largest two units', () => {
    expect(formatDuration(12)).toBe('12s');
    expect(formatDuration(184)).toBe('3m 4s');
    expect(formatDuration(3724)).toBe('1h 2m');
    expect(formatDuration(undefined)).toBe('—');
  });
});
