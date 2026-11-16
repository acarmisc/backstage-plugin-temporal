/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Content,
  Header,
  Link,
  Page,
  Select,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { Button, Grid, TextField, Typography } from '@material-ui/core';
import type {
  ClusterSummary,
  RunStatus,
  TemporalWorkflowSummary,
  WorkflowListResponse,
} from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { formatDuration } from './format';
import { OwnerText, ownerOf, useStreamOwners } from './owners';
import { RunStatusBadge } from './StatusBadge';
import { schedulesLink, useUrlParams, withQuery, workflowLink } from './links';

const STATUSES: RunStatus[] = [
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'TERMINATED',
  'TIMED_OUT',
];
const RANGE_KEYS = ['any', '24h', '7d', '30d', 'custom'] as const;
type Range = (typeof RANGE_KEYS)[number];
const RANGE_LABELS: Record<Range, string> = {
  any: 'Any',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom',
};
const RANGE_MS: Partial<Record<Range, number>> = {
  '24h': 864e5,
  '7d': 7 * 864e5,
  '30d': 30 * 864e5,
};
const PAGE_SIZES = [10, 25, 50, 100];

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

const opts = (values: string[]) => values.map(v => ({ label: v, value: v }));

/** Workflow browser: filters in a sidebar, a page of executions, token-based paging. */
export function WorkflowsPage() {
  const api = useTemporalApi();
  const initialParams = useUrlParams();
  const [view, setView] = useState(() => readView(initialParams));
  // Stack of page tokens: the last one is the current page, `undefined` the first.
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const owners = useStreamOwners();
  const clusters = useLoad(() => api.get<ClusterSummary[]>('/clusters'), [api]);

  const cluster = view.cluster ?? clusters.data?.[0]?.name;
  const clusterInfo = clusters.data?.find(c => c.name === cluster);
  const namespace = view.namespace ?? clusterInfo?.namespaces[0];
  const statusKey = view.status.join(',');
  const startTime = useMemo(
    () => startTimeFor(view.range, view.customStart),
    [view.range, view.customStart],
  );
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
    [
      api,
      cluster,
      namespace,
      statusKey,
      view.workflowType,
      startTime,
      view.pageSize,
      token,
    ],
  );

  // Keeps the URL in step with the filters so the view can be shared.
  useEffect(() => {
    const url = withQuery(window.location.pathname, {
      cluster,
      namespace,
      status: statusKey || undefined,
      workflowType: view.workflowType || undefined,
      range: view.range === 'any' ? undefined : view.range,
      customStart:
        view.range === 'custom' && view.customStart
          ? view.customStart
          : undefined,
      pageSize: String(view.pageSize),
    });
    window.history.replaceState(window.history.state, '', url);
  }, [
    cluster,
    namespace,
    statusKey,
    view.workflowType,
    view.range,
    view.customStart,
    view.pageSize,
  ]);

  // Any filter change starts again from page 1.
  const update = (patch: Partial<View>) => {
    setView(v => ({ ...v, ...patch }));
    setPages([undefined]);
  };
  const commitType = (value: string) => {
    if (value !== view.workflowType) update({ workflowType: value });
  };

  const rows = list.data?.workflows ?? [];

  const uiBase = clusterInfo?.uiBaseUrl;

  const detailLink = (w: TemporalWorkflowSummary) =>
    workflowLink({
      cluster: cluster!,
      namespace: w.namespace,
      workflowId: w.workflowId,
      runId: w.runId,
    });
  const columns: TableColumn<TemporalWorkflowSummary>[] = [
    {
      title: 'Workflow ID',
      field: 'workflowId',
      render: w => <Link to={detailLink(w)}>{w.workflowId}</Link>,
    },
    {
      title: 'Run ID',
      field: 'runId',
      render: w => <span title={w.runId}>{w.runId.slice(0, 8)}</span>,
    },
    {
      title: 'Owner',
      sorting: false,
      render: w => <OwnerText owner={ownerOf(owners, w.workflowId)} />,
    },
    { title: 'Workflow Type', field: 'workflowType' },
    { title: 'Task Queue', field: 'taskQueue' },
    {
      title: 'Status',
      field: 'status',
      render: w => <RunStatusBadge status={w.status} />,
    },
    {
      title: 'Start Time',
      field: 'startTime',
      render: w => new Date(w.startTime).toLocaleString(),
    },
    {
      title: 'Duration',
      customSort: (a, b) =>
        (a.durationSeconds ?? -1) - (b.durationSeconds ?? -1),
      render: w => formatDuration(w.durationSeconds),
    },
    {
      title: 'Actions',
      sorting: false,
      render: w => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {uiBase && (
            <>
              <Link
                to={`${uiBase}/namespaces/${
                  w.namespace
                }/workflows/${encodeURIComponent(w.workflowId)}/${
                  w.runId
                }/history`}
              >
                Open in Temporal UI
              </Link>{' '}
            </>
          )}
          <Link to={detailLink(w)}>Details</Link>
        </span>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header
        title="Temporal workflows"
        subtitle={cluster && namespace ? `${cluster} / ${namespace}` : ''}
      />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Grid container spacing={2} alignItems="flex-end">
              {clusters.data && clusters.data.length > 1 && (
                <Grid item xs={12} sm={6} md={2}>
                  <Select
                    label="Cluster"
                    items={opts(clusters.data.map(c => c.name))}
                    selected={cluster ?? ''}
                    onChange={v =>
                      update({ cluster: String(v), namespace: undefined })
                    }
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={2}>
                <Select
                  label="Namespace"
                  disabled={!clusterInfo}
                  items={opts(clusterInfo?.namespaces ?? [])}
                  selected={namespace ?? ''}
                  onChange={v => update({ namespace: String(v) })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Select
                  multiple
                  label="Status"
                  placeholder="All"
                  items={opts(STATUSES)}
                  selected={view.status}
                  onChange={v => update({ status: v as RunStatus[] })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Workflow type"
                  variant="outlined"
                  size="small"
                  defaultValue={view.workflowType}
                  onBlur={e => commitType(e.target.value.trim())}
                  onKeyDown={e => {
                    if (e.key === 'Enter')
                      commitType((e.target as HTMLInputElement).value.trim());
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Select
                  label="Start time"
                  items={RANGE_KEYS.map(r => ({
                    label: RANGE_LABELS[r],
                    value: r,
                  }))}
                  selected={view.range}
                  onChange={v => update({ range: v as Range })}
                />
              </Grid>
              {view.range === 'custom' && (
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="datetime-local"
                    variant="outlined"
                    size="small"
                    inputProps={{ 'aria-label': 'Start time from' }}
                    value={view.customStart}
                    onChange={e => update({ customStart: e.target.value })}
                  />
                </Grid>
              )}
              <Grid item style={{ marginLeft: 'auto' }}>
                <Link to={schedulesLink({ cluster, namespace })}>
                  Schedules
                </Link>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            {clusters.error && <p role="alert">{clusters.error}</p>}
            {list.error && (
              <p role="alert">Could not load workflows: {list.error}</p>
            )}
            <Table<TemporalWorkflowSummary>
              title="Workflows"
              isLoading={list.loading && !list.data}
              options={{ paging: false, search: false, padding: 'dense' }}
              columns={columns}
              data={rows}
              emptyContent={
                <Typography style={{ padding: 16 }}>
                  No workflows match these filters.
                </Typography>
              }
            />
            <Grid
              container
              spacing={2}
              alignItems="center"
              style={{ marginTop: 8 }}
            >
              <Grid item>
                <Button
                  variant="outlined"
                  disabled={pages.length === 1}
                  onClick={() => setPages(p => p.slice(0, -1))}
                >
                  Previous
                </Button>
              </Grid>
              <Grid item>Page {pages.length}</Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  disabled={!list.data?.nextPageToken}
                  onClick={() =>
                    setPages(p => [...p, list.data?.nextPageToken])
                  }
                >
                  Next
                </Button>
              </Grid>
              <Grid item style={{ minWidth: 140 }}>
                <Select
                  label="Page size"
                  items={opts(PAGE_SIZES.map(String))}
                  selected={String(view.pageSize)}
                  onChange={v => update({ pageSize: Number(v) })}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
