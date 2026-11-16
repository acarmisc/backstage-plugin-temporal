/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import type { ClusterSummary, WorkflowListResponse } from '@acarmisc/backstage-plugin-temporal-common';

const get = jest.fn();
const mockOwners = new Map<string, { ownerRef: string; entityRef: string }>();
// Stable identity: the real `useTemporalApi` is memoized, a fresh object per
// render would retrigger every `useLoad` forever.
const api = { get };
jest.mock('./owners', () => ({
  ...jest.requireActual('./owners'),
  useStreamOwners: () => mockOwners,
}));
jest.mock('../api', () => ({ useTemporalApi: () => api }));

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
    await renderInTestApp(<WorkflowsPage />);

    const link = await screen.findByRole('link', { name: 'order-42' });
    expect(link).toHaveAttribute(
      'href',
      '/temporal/workflow?cluster=temporal&namespace=default&workflowId=order-42&runId=0f1e2d3c-aaaa-bbbb-cccc-ddddeeeeffff',
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('COMPLETED')).toBeInTheDocument();
    expect(within(table).getByText('3m 4s')).toBeInTheDocument();
  });

  it('shows the catalog owner of the stream, and a dash when unowned', async () => {
    mockOwners.set('order-42', { ownerRef: 'group:default/team-a', entityRef: 'component:default/orders' });
    await renderInTestApp(<WorkflowsPage />);
    const row = (await screen.findByRole('link', { name: 'order-42' })).closest('tr')!;
    expect(row).toHaveTextContent('team-a');

    mockOwners.clear();
    cleanup();
    await renderInTestApp(<WorkflowsPage />);
    expect((await screen.findByRole('link', { name: 'order-42' })).closest('tr')).toHaveTextContent('—');
  });

  it('filters by status and keeps the filter in the URL', async () => {
    await renderInTestApp(<WorkflowsPage />);
    await screen.findByRole('link', { name: 'order-42' });

    fireEvent.mouseDown(screen.getAllByRole('button', { name: /All/ })[0]);
    fireEvent.click(await screen.findByRole('option', { name: /FAILED/ }));

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
