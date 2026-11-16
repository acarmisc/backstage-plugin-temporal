/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import type {
  ClusterSummary,
  RunStatus,
  TemporalWorkflowSummary,
  WorkflowListResponse,
} from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { formatDuration } from './format';
import { RunStatusBadge } from './StatusBadge';
import { schedulesLink, useUrlParams, withQuery, workflowLink } from './links';

const STATUSES: RunStatus[] = ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELED', 'TERMINATED', 'TIMED_OUT'];
const RANGE_KEYS = ['any', '24h', '7d', '30d', 'custom'] as const;
type Range = (typeof RANGE_KEYS)[number];
const RANGE_LABELS: Record<Range, string> = {
  any: 'Any',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom',
};
const RANGE_MS: Partial<Record<Range, number>> = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 };
const PAGE_SIZES = [10, 25, 50, 100];
const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const ARROW = { asc: ' ▲', desc: ' ▼' } as const;

type SortKey = 'startTime' | 'durationSeconds';
interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

/** Everything the page shows that a link can carry. Mirrored in the URL. */
interface View {
  cluster?: string;
  namespace?: string;
  status: RunStatus[];
  workflowType: string;
  range: Range;
  customStart: string;
  pageSize: number;
}

function readView(params: URLSearchParams): View {
  const pageSize = Number(params.get('pageSize'));
  return {
    cluster: params.get('cluster') ?? undefined,
    namespace: params.get('namespace') ?? undefined,
    status: (params.get('status') ?? '')
      .split(',')
      .filter((s): s is RunStatus => (STATUSES as string[]).includes(s)),
    workflowType: params.get('workflowType') ?? '',
    range: RANGE_KEYS.find(r => r === params.get('range')) ?? 'any',
    customStart: params.get('customStart') ?? '',
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : 25,
  };
}

/** Lower bound of the start time. Memoised by the caller so a re-render does not refetch. */
function startTimeFor(range: Range, customStart: string): string | undefined {
  if (range === 'custom') {
    const date = new Date(customStart);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const span = RANGE_MS[range];
  return span ? new Date(Date.now() - span).toISOString() : undefined;
}

// shortcut: sorts the loaded page only; Temporal visibility has no ORDER BY — upgrade if advanced visibility sorting is needed
function sortRows(rows: TemporalWorkflowSummary[], sort?: Sort): TemporalWorkflowSummary[] {
  if (!sort) return rows;
  const value = (w: TemporalWorkflowSummary) =>
    sort.key === 'startTime' ? Date.parse(w.startTime) : (w.durationSeconds ?? -1);
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => (value(a) - value(b)) * sign);
}

const cell = { padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,0.25)', textAlign: 'left' as const };
const plainButton = { background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' };

/** Workflow browser: filters in a sidebar, a page of executions, token-based paging. */
export function WorkflowsPage() {
  const api = useTemporalApi();
  const initialParams = useUrlParams();
  const [view, setView] = useState(() => readView(initialParams));
  const [sort, setSort] = useState<Sort>();
  // Stack of page tokens: the last one is the current page, `undefined` the first.
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const clusters = useLoad(() => api.get<ClusterSummary[]>('/clusters'), [api]);

  const cluster = view.cluster ?? clusters.data?.[0]?.name;
  const clusterInfo = clusters.data?.find(c => c.name === cluster);
  const namespace = view.namespace ?? clusterInfo?.namespaces[0];
  const statusKey = view.status.join(',');
  const startTime = useMemo(() => startTimeFor(view.range, view.customStart), [view.range, view.customStart]);
  const token = pages[pages.length - 1];

  // Requires cluster and namespace, which come from `/clusters`: asking earlier is a 400.
  const list = useLoad(
    () =>
      cluster && namespace
        ? api.get<WorkflowListResponse>('/workflows', {
            cluster,
            namespace,
            status: statusKey || undefined,
            workflowType: view.workflowType || undefined,
            startTime,
            pageSize: view.pageSize,
            nextPageToken: token,
          })
        : undefined,
    [api, cluster, namespace, statusKey, view.workflowType, startTime, view.pageSize, token],
  );

  // Keeps the URL in step with the filters so the view can be shared.
  useEffect(() => {
    const url = withQuery(window.location.pathname, {
      cluster,
      namespace,
      status: statusKey || undefined,
      workflowType: view.workflowType || undefined,
      range: view.range === 'any' ? undefined : view.range,
      customStart: view.range === 'custom' && view.customStart ? view.customStart : undefined,
      pageSize: String(view.pageSize),
    });
    window.history.replaceState(window.history.state, '', url);
  }, [cluster, namespace, statusKey, view.workflowType, view.range, view.customStart, view.pageSize]);

  // Any filter change starts again from page 1.
  const update = (patch: Partial<View>) => {
    setView(v => ({ ...v, ...patch }));
    setPages([undefined]);
  };
  const toggleStatus = (s: RunStatus) =>
    update({ status: view.status.includes(s) ? view.status.filter(x => x !== s) : [...view.status, s] });
  const commitType = (value: string) => {
    if (value !== view.workflowType) update({ workflowType: value });
  };
  const toggleSort = (key: SortKey) =>
    setSort(s => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const rows = useMemo(() => sortRows(list.data?.workflows ?? [], sort), [list.data, sort]);
  const typeOptions = useMemo(
    () => [...new Set((list.data?.workflows ?? []).map(w => w.workflowType))],
    [list.data],
  );

  const uiBase = clusterInfo?.uiBaseUrl;

  const sortHeader = (key: SortKey, label: string) => {
    const dir = sort?.key === key ? sort.dir : undefined;
    return (
      <th style={cell} aria-sort={dir ? ARIA_SORT[dir] : 'none'}>
        <button type="button" onClick={() => toggleSort(key)} style={plainButton}>
          {label}
          {dir && ARROW[dir]}
        </button>
      </th>
    );
  };

  return (
    <Page themeId="tool">
      <Header title="Temporal workflows" subtitle={cluster && namespace ? `${cluster} / ${namespace}` : ''} />
      <Content>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          {sidebarOpen && (
            <aside aria-label="Filters" style={{ flex: '0 0 240px', display: 'grid', gap: 12 }}>
              {clusters.data && clusters.data.length > 1 && (
                <label>
                  Cluster
                  <select
                    value={cluster ?? ''}
                    onChange={e => update({ cluster: e.target.value, namespace: undefined })}
                    style={{ display: 'block', width: '100%' }}
                  >
                    {clusters.data.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Namespace
                <select
                  value={namespace ?? ''}
                  disabled={!clusterInfo}
                  onChange={e => update({ namespace: e.target.value })}
                  style={{ display: 'block', width: '100%' }}
                >
                  {clusterInfo?.namespaces.map(ns => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend>Status</legend>
                {STATUSES.map(s => (
                  <label key={s} style={{ display: 'block' }}>
                    <input type="checkbox" checked={view.status.includes(s)} onChange={() => toggleStatus(s)} /> {s}
                  </label>
                ))}
              </fieldset>
              <label>
                Workflow type
                <input
                  list="temporal-workflow-types"
                  defaultValue={view.workflowType}
                  onBlur={e => commitType(e.target.value.trim())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitType(e.currentTarget.value.trim());
                  }}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                />
                <datalist id="temporal-workflow-types">
                  {typeOptions.map(t => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label>
                Start time
                <select
                  value={view.range}
                  onChange={e => update({ range: e.target.value as Range })}
                  style={{ display: 'block', width: '100%' }}
                >
                  {RANGE_KEYS.map(r => (
                    <option key={r} value={r}>
                      {RANGE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              {view.range === 'custom' && (
                <input
                  type="datetime-local"
                  aria-label="Start time from"
                  value={view.customStart}
                  onChange={e => update({ customStart: e.target.value })}
                />
              )}
            </aside>
          )}

          <main style={{ flex: '1 1 480px', minWidth: 0 }}>
            <button type="button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(o => !o)} style={{ marginBottom: 8 }}>
              {sidebarOpen ? 'Hide filters' : 'Show filters'}
            </button>{' '}
            <a href={schedulesLink({ cluster, namespace })}>Schedules</a>
            {clusters.error && <p role="alert">{clusters.error}</p>}
            {list.error && <p role="alert">Could not load workflows: {list.error}</p>}
            {list.loading && !list.data && <p>Loading workflows…</p>}
            {list.data && rows.length === 0 && <p>No workflows match these filters.</p>}
            {list.data && rows.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cell}>Workflow ID</th>
                    <th style={cell}>Run ID</th>
                    <th style={cell}>Workflow Type</th>
                    <th style={cell}>Task Queue</th>
                    <th style={cell}>Status</th>
                    {sortHeader('startTime', 'Start Time')}
                    {sortHeader('durationSeconds', 'Duration')}
                    <th style={cell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(w => {
                    const ui =
                      uiBase &&
                      `${uiBase}/namespaces/${w.namespace}/workflows/${encodeURIComponent(w.workflowId)}/${w.runId}/history`;
                    return (
                      <tr key={`${w.namespace}/${w.workflowId}/${w.runId}`}>
                        <td style={cell}>
                          <a href={workflowLink({ cluster: cluster!, namespace: w.namespace, workflowId: w.workflowId, runId: w.runId })}>
                            {w.workflowId}
                          </a>
                        </td>
                        <td style={cell} title={w.runId}>
                          {w.runId.slice(0, 8)}
                        </td>
                        <td style={cell}>{w.workflowType}</td>
                        <td style={cell}>{w.taskQueue}</td>
                        <td style={cell}>
                          <RunStatusBadge status={w.status} />
                        </td>
                        <td style={cell}>{new Date(w.startTime).toLocaleString()}</td>
                        <td style={cell}>{formatDuration(w.durationSeconds)}</td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          {ui && (
                            <>
                              <a href={ui} target="_blank" rel="noreferrer">
                                Open in Temporal UI
                              </a>{' '}
                            </>
                          )}
                          <a href={workflowLink({ cluster: cluster!, namespace: w.namespace, workflowId: w.workflowId, runId: w.runId })}>
                            Details
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
              <button type="button" disabled={pages.length === 1} onClick={() => setPages(p => p.slice(0, -1))}>
                Previous
              </button>
              <span>Page {pages.length}</span>
              <button
                type="button"
                disabled={!list.data?.nextPageToken}
                onClick={() => setPages(p => [...p, list.data?.nextPageToken])}
              >
                Next
              </button>
              <label>
                Page size{' '}
                <select value={view.pageSize} onChange={e => update({ pageSize: Number(e.target.value) })}>
                  {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </main>
        </div>
      </Content>
    </Page>
  );
}
