/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { useMemo } from 'react';

/** Page links carry their state in the query string, so they can be shared. */
export function useUrlParams(): URLSearchParams {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

export function streamLink(params: { cluster: string; namespace: string; name: string; run?: string }) {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return `/temporal/stream?${search.toString()}`;
}
