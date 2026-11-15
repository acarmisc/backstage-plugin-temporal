/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, Header, Page } from '@backstage/core-components';
import type { ClusterSummary, StreamSummary } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { FreshnessBadge, RunStatusBadge } from './StatusBadge';
import { streamLink, useUrlParams, workflowsLink } from './links';

function statusDot(status: string): string {
  if (status === 'COMPLETED') return '#16a34a';
  if (status === 'RUNNING') return '#3b82f6';
  return '#dc2626';
}

function scheduleText(stream: StreamSummary): string {
  if (!stream.schedule) return 'on demand';
  if (stream.schedule.paused) return 'paused';
  if (stream.schedule.nextRunTime) return `next ${new Date(stream.schedule.nextRunTime).toLocaleString()}`;
  return 'scheduled';
}

const cell = { padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,0.25)', textAlign: 'left' as const };

/** All streams of one namespace: schedule, last run, freshness of the last success. */
export function StreamsPage() {
  const api = useTemporalApi();
  const params = useUrlParams();
  const clusters = useLoad(() => api.get<ClusterSummary[]>('/clusters'), [api]);

  const cluster = params.get('cluster') ?? clusters.data?.[0]?.name;
  const namespace = params.get('namespace') ?? clusters.data?.find(c => c.name === cluster)?.namespaces[0];

  // Both come from `/clusters`: requesting streams before it answers is a 400
  // (`query parameter "cluster" is required`) and leaves a stale error on screen.
  const streams = useLoad(
    () =>
      cluster && namespace
        ? api.get<StreamSummary[]>('/streams', { cluster, namespace })
        : undefined,
    [api, cluster, namespace],
  );

  return (
    <Page themeId="tool">
      <Header title="Temporal streams" subtitle={cluster && namespace ? `${cluster} / ${namespace}` : ''}>
        <a href={workflowsLink({ cluster, namespace })}>Browse all workflows</a>
      </Header>
      <Content>
        {clusters.error && <p role="alert">{clusters.error}</p>}
        {streams.error && <p role="alert">Could not load streams: {streams.error}</p>}
        {streams.loading && !streams.data && <p>Loading streams…</p>}
        {streams.data && streams.data.length === 0 && <p>No streams in this namespace.</p>}
        {streams.data && streams.data.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cell}>Stream</th>
                <th style={cell}>Schedule</th>
                <th style={cell}>Last run</th>
                <th style={cell}>Last success</th>
                <th style={cell}>Recent</th>
              </tr>
            </thead>
            <tbody>
              {streams.data.map(stream => (
                <tr key={stream.name}>
                  <td style={cell}>
                    <a href={streamLink({ cluster: cluster!, namespace: namespace!, name: stream.name })}>
                      {stream.name}
                    </a>
                  </td>
                  <td style={cell}>{scheduleText(stream)}</td>
                  <td style={cell}>{stream.lastRun ? <RunStatusBadge status={stream.lastRun.status} /> : '—'}</td>
                  <td style={cell}>
                    <FreshnessBadge lastSuccessAt={stream.lastSuccess?.startTime} />
                  </td>
                  <td style={cell}>{stream.recentStatuses.map((s, i) => (
                    <span key={i} title={s} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 3, background: statusDot(s) }} />
                  ))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Content>
    </Page>
  );
}
