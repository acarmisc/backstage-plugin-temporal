/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { screen, waitFor } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import type { ClusterSummary } from '@acarmisc/backstage-plugin-temporal-common';

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

import { StreamsPage } from './StreamsPage';

describe('StreamsPage', () => {
  beforeEach(() => get.mockReset());

  it('asks for streams only once the cluster list is known', async () => {
    let resolveClusters: ((clusters: ClusterSummary[]) => void) | undefined;
    get.mockImplementation((path: string) => {
      if (path === '/clusters') {
        return new Promise<ClusterSummary[]>(resolve => {
          resolveClusters = resolve;
        });
      }
      return Promise.resolve([]);
    });

    await renderInTestApp(<StreamsPage />);

    // Asking `/streams` without `cluster` is a 400 on the backend.
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/clusters');
    expect(screen.queryByRole('alert')).toBeNull();

    resolveClusters?.([
      { name: 'temporal', namespaces: ['kb'] } as ClusterSummary,
    ]);

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/streams', {
        cluster: 'temporal',
        namespace: 'kb',
      }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
