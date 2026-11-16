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
import type {
  ClusterSummary,
  StreamSummary,
} from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { FreshnessBadge, RunStatusBadge } from './StatusBadge';
import { OwnerText, useStreamOwners } from './owners';
import { streamLink, useUrlParams, workflowsLink } from './links';

function statusDot(status: string): string {
  if (status === 'COMPLETED') return '#16a34a';
  if (status === 'RUNNING') return '#3b82f6';
  return '#dc2626';
}

function scheduleText(stream: StreamSummary): string {
  if (!stream.schedule) return 'on demand';
  if (stream.schedule.paused) return 'paused';
  if (stream.schedule.nextRunTime)
    return `next ${new Date(stream.schedule.nextRunTime).toLocaleString()}`;
  return 'scheduled';
}

/** All streams of one namespace: schedule, last run, freshness of the last success. */
export function StreamsPage() {
  const api = useTemporalApi();
  const params = useUrlParams();
  const owners = useStreamOwners();
  const clusters = useLoad(() => api.get<ClusterSummary[]>('/clusters'), [api]);

  const cluster = params.get('cluster') ?? clusters.data?.[0]?.name;
  const namespace =
    params.get('namespace') ??
    clusters.data?.find(c => c.name === cluster)?.namespaces[0];

  // Both come from `/clusters`: requesting streams before it answers is a 400
  // (`query parameter "cluster" is required`) and leaves a stale error on screen.
  const streams = useLoad(
    () =>
      cluster && namespace
        ? api.get<StreamSummary[]>('/streams', { cluster, namespace })
        : undefined,
    [api, cluster, namespace],
  );

  const columns: TableColumn<StreamSummary>[] = [
    {
      title: 'Stream',
      field: 'name',
      render: stream => (
        <a
          href={streamLink({
            cluster: cluster!,
            namespace: namespace!,
            name: stream.name,
          })}
        >
          {stream.name}
        </a>
      ),
    },
    {
      title: 'Owner',
      sorting: false,
      render: stream => <OwnerText owner={owners.get(stream.name)} />,
    },
    {
      title: 'Schedule',
      sorting: false,
      render: stream => scheduleText(stream),
    },
    {
      title: 'Last run',
      sorting: false,
      render: stream =>
        stream.lastRun ? (
          <RunStatusBadge status={stream.lastRun.status} />
        ) : (
          '—'
        ),
    },
    {
      title: 'Last success',
      sorting: false,
      render: stream => (
        <FreshnessBadge lastSuccessAt={stream.lastSuccess?.startTime} />
      ),
    },
    {
      title: 'Recent',
      sorting: false,
      render: stream => (
        <span>
          {stream.recentStatuses.map((st, i) => (
            <span
              key={i}
              title={st}
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 4,
                marginRight: 3,
                background: statusDot(st),
              }}
            />
          ))}
        </span>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header
        title="Temporal streams"
        subtitle={cluster && namespace ? `${cluster} / ${namespace}` : ''}
      >
        <a href={workflowsLink({ cluster, namespace })}>Browse all workflows</a>
      </Header>
      <Content>
        {clusters.error && <p role="alert">{clusters.error}</p>}
        {streams.error && (
          <p role="alert">Could not load streams: {streams.error}</p>
        )}
        {streams.loading && !streams.data && <p>Loading streams…</p>}
        {streams.data && (
          <Table<StreamSummary>
            title="Streams"
            options={{ paging: false, search: false, padding: 'dense' }}
            columns={columns}
            data={streams.data}
            emptyContent={
              <p style={{ padding: 16 }}>No streams in this namespace.</p>
            }
          />
        )}
      </Content>
    </Page>
  );
}
