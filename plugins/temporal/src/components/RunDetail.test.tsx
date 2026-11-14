/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen, waitFor } from '@testing-library/react';
import type { RunDetail as RunDetailData } from '@acarmisc/backstage-plugin-temporal-common';

const get = jest.fn();
jest.mock('../api', () => ({ useTemporalApi: () => ({ get }) }));
jest.mock('./useIsDark', () => ({ useIsDark: () => false }));
jest.mock('./WorkflowDiagram', () => ({ WorkflowDiagram: () => null }));

import { RunDetail } from './RunDetail';

const base = {
  workflowId: 'stream/demo/20261115T090000',
  startTime: '2026-11-15T09:00:00.000Z',
  stream: 'demo',
  graph: undefined,
  uiUrl: undefined,
};

describe('RunDetail', () => {
  beforeEach(() => get.mockReset());

  it('shows the stage that is running', async () => {
    const run: RunDetailData = {
      ...base,
      status: 'RUNNING',
      stages: [
        { stage: 'fetch', state: 'ok' },
        { stage: 'review', state: 'running', attempt: 1 },
      ],
    };
    get.mockResolvedValue(run);
    render(<RunDetail cluster="staging" namespace="kb" workflowId={base.workflowId} />);
    await waitFor(() => expect(screen.getByTestId('run-stage-review')).toHaveTextContent('running'));
    expect(screen.getByText(/live/)).toBeInTheDocument();
  });

  it('shows the redacted error of a failed stage', async () => {
    const run: RunDetailData = {
      ...base,
      status: 'FAILED',
      stages: [{ stage: 'publish', state: 'failed', error: 'upload refused [REDACTED]' }],
    };
    get.mockResolvedValue(run);
    render(<RunDetail cluster="staging" namespace="kb" workflowId={base.workflowId} />);
    await waitFor(() => expect(screen.getByText('upload refused [REDACTED]')).toBeInTheDocument());
    expect(screen.queryByText(/live/)).not.toBeInTheDocument();
  });

  it('reports a backend error instead of an empty page', async () => {
    get.mockRejectedValue(new Error('403: missing permission temporal.read'));
    render(<RunDetail cluster="staging" namespace="kb" workflowId={base.workflowId} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('missing permission'));
  });
});
