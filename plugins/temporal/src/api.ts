/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/frontend-plugin-api';

export type Query = Record<string, string | number | undefined>;

/**
 * Calls the plugin's backend API. The browser never talks to Temporal directly.
 * Errors carry the HTTP status so the UI can tell "not allowed" from "down".
 */
export function useTemporalApi() {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  return useMemo(
    () => ({
      async get<T>(path: string, query: Query = {}): Promise<T> {
        const base = await discovery.getBaseUrl('temporal');
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined) search.set(key, String(value));
        }
        const qs = search.toString();
        const response = await fetchApi.fetch(`${base}${path}${qs ? `?${qs}` : ''}`);
        if (!response.ok) {
          const error = new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }
        return (await response.json()) as T;
      },
    }),
    [discovery, fetchApi],
  );
}
