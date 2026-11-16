/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Content,
  Header,
  Page,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import type { RunSummary } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { RunDetail } from './RunDetail';
import { RunStatusBadge } from './StatusBadge';
import { streamLink, useUrlParams } from './links';

/** One stream: its recent runs, and the selected run in detail. */
export function StreamPage() {
  const api = useTemporalApi();
  const params = useUrlParams();
  const cluster = params.get('cluster') ?? '';
  const namespace = params.get('namespace') ?? '';
  const name = params.get('name') ?? '';
  const selected = params.get('run') ?? undefined;

  const runs = useLoad(
    () =>
      cluster && namespace && name
        ? api.get<RunSummary[]>(`/streams/${encodeURIComponent(name)}/runs`, {
            cluster,
            namespace,
            limit: 20,
          })
        : undefined,
    [api, cluster, namespace, name],
  );
  const current = selected ?? runs.data?.[0]?.workflowId;

  const columns: TableColumn<RunSummary>[] = [
    {
      title: 'Run',
      field: 'workflowId',
      render: run => (
        <a href={streamLink({ cluster, namespace, name, run: run.workflowId })}>
          {run.workflowId.split('/').slice(2).join('/') || run.workflowId}
        </a>
      ),
    },
    {
      title: 'Status',
      field: 'status',
      render: run => <RunStatusBadge status={run.status} />,
    },
    {
      title: 'Started',
      field: 'startTime',
      render: run => new Date(run.startTime).toLocaleString(),
    },
    {
      title: 'Duration',
      customSort: (a, b) =>
        (a.durationSeconds ?? -1) - (b.durationSeconds ?? -1),
      render: run =>
        run.durationSeconds !== undefined ? `${run.durationSeconds}s` : '—',
    },
  ];

  return (
    <Page themeId="tool">
      <Header title={name || 'Stream'} subtitle={`${cluster} / ${namespace}`} />
      <Content>
        {runs.error && <p role="alert">Could not load runs: {runs.error}</p>}
        {runs.data && runs.data.length === 0 && <p>No runs yet.</p>}
        {runs.data && runs.data.length > 0 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Table<RunSummary>
                title="Runs"
                options={{
                  paging: false,
                  search: false,
                  padding: 'dense',
                  rowStyle: (run: RunSummary) => ({
                    background:
                      run.workflowId === current
                        ? 'rgba(59,130,246,0.1)'
                        : undefined,
                  }),
                }}
                columns={columns}
                data={runs.data}
              />
            </div>
            {current && (
              <RunDetail
                cluster={cluster}
                namespace={namespace}
                workflowId={current}
              />
            )}
          </>
        )}
      </Content>
    </Page>
  );
}
