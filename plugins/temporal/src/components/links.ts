/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';

/** Page links carry their state in the query string, so they can be shared. */
export function useUrlParams(): URLSearchParams {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

/** `path?query`, leaving out undefined values. */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function streamLink(params: { cluster: string; namespace: string; name: string; run?: string }) {
  return withQuery('/temporal/stream', params);
}

export function workflowLink(params: { cluster: string; namespace: string; workflowId: string; runId: string }) {
  return withQuery('/temporal/workflow', params);
}

export function workflowsLink(params: { cluster?: string; namespace?: string } = {}) {
  return withQuery('/temporal/workflows', params);
}

export function schedulesLink(params: { cluster?: string; namespace?: string } = {}) {
  return withQuery('/temporal/schedules', params);
}

export function scheduleLink(params: { cluster: string; namespace: string; scheduleId: string }) {
  return withQuery('/temporal/schedule', params);
}
