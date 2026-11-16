/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Content, Header, Link, Page, Select } from '@backstage/core-components';
import { Grid } from '@material-ui/core';
import type { ClusterSummary, ScheduleListItem, ScheduleListResponse } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { cadenceText, relativeTime } from './format';
import { OwnerText, useStreamOwners, type StreamOwner } from './owners';
import { RunStatusBadge } from './StatusBadge';
import { scheduleLink, useUrlParams, withQuery, workflowsLink } from './links';

export const card = { border: '1px solid rgba(128,128,128,0.3)', borderRadius: 10, padding: 16 };
const FILTERS = ['all', 'active', 'paused'] as const;
type Filter = (typeof FILTERS)[number];

export function StateBadge({ paused }: { paused: boolean }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        background: paused ? '#d97706' : '#16a34a',
      }}
    >
      {paused ? 'Paused' : 'Active'}
    </span>
  );
}

/** Dots on a line from now to the last upcoming run, so the rhythm is visible at a glance. */
export function Timeline({ times }: { times: string[] }) {
  if (times.length === 0) return null;
  const now = Date.now();
  const span = Math.max(Date.parse(times[times.length - 1]) - now, 1);
  return (
    <div role="img" aria-label={`${times.length} upcoming runs`} style={{ position: 'relative', height: 14, margin: '10px 4px 4px' }}>
      <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 2, background: 'rgba(128,128,128,0.35)' }} />
      {times.map(t => (
        <span
          key={t}
          title={new Date(t).toLocaleString()}
          style={{
            position: 'absolute',
            top: 1,
            left: `${Math.min(((Date.parse(t) - now) / span) * 100, 100)}%`,
            width: 12,
            height: 12,
            marginLeft: -6,
            borderRadius: '50%',
            background: '#3b82f6',
          }}
        />
      ))}
    </div>
  );
}

function ScheduleCard({ item, cluster, namespace, owner }: { item: ScheduleListItem; cluster: string; namespace: string; owner?: StreamOwner }) {
  const next = item.nextActionTimes[0];
  let nextRun: ReactNode = 'Next run: none';
  if (item.paused) nextRun = 'Next run: paused';
  else if (next)
    nextRun = (
      <>
        Next run: <strong>{relativeTime(next)}</strong> <span style={{ opacity: 0.7 }}>({new Date(next).toLocaleString()})</span>
      </>
    );
  let lastRun: ReactNode = 'never';
  if (item.lastRun)
    lastRun = (
      <>
        <RunStatusBadge status={item.lastRun.status} />
        <span style={{ opacity: 0.7 }}>{relativeTime(item.lastRun.startTime)}</span>
      </>
    );
  else if (item.lastActionAt) lastRun = relativeTime(item.lastActionAt);
  return (
    <a
      href={scheduleLink({ cluster, namespace, scheduleId: item.scheduleId })}
      style={{ ...card, display: 'block', color: 'inherit', textDecoration: 'none', opacity: item.paused ? 0.8 : 1 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong style={{ wordBreak: 'break-all' }}>{item.scheduleId}</strong>
        <StateBadge paused={item.paused} />
      </div>
      <div style={{ fontSize: 18, margin: '8px 0 2px' }}>{cadenceText(item.spec)}</div>
      <div style={{ fontSize: 13, opacity: 0.75 }}>{item.workflowType ?? '—'}</div>
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Owner: <OwnerText owner={owner} />
      </div>
      <div style={{ marginTop: 10, fontSize: 14 }}>
        {nextRun}
      </div>
      <div style={{ marginTop: 6, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        Last run:{' '}
        {lastRun}
      </div>
      <Timeline times={item.paused ? [] : item.nextActionTimes} />
    </a>
  );
}

/** Read-only grid of the namespace's Temporal Schedules. */
export function SchedulesPage() {
  const api = useTemporalApi();
  const params = useUrlParams();
  const [filter, setFilter] = useState<Filter>(() => FILTERS.find(f => f === params.get('state')) ?? 'all');
  const [chosen, setChosen] = useState({ cluster: params.get('cluster') ?? undefined, namespace: params.get('namespace') ?? undefined });
  const owners = useStreamOwners();
  const clusters = useLoad(() => api.get<ClusterSummary[]>('/clusters'), [api]);

  const cluster = chosen.cluster ?? clusters.data?.[0]?.name;
  const clusterInfo = clusters.data?.find(c => c.name === cluster);
  const namespace = chosen.namespace ?? clusterInfo?.namespaces[0];
  const list = useLoad(
    () => (cluster && namespace ? api.get<ScheduleListResponse>('/schedules', { cluster, namespace }) : undefined),
    [api, cluster, namespace],
    60_000,
  );

  useEffect(() => {
    const url = withQuery(window.location.pathname, { cluster, namespace, state: filter === 'all' ? undefined : filter });
    window.history.replaceState(window.history.state, '', url);
  }, [cluster, namespace, filter]);

  const shown = (list.data?.schedules ?? []).filter(s => filter === 'all' || s.paused === (filter === 'paused'));

  return (
    <Page themeId="tool">
      <Header title="Temporal schedules" subtitle={cluster && namespace ? `${cluster} / ${namespace}` : ''} />
      <Content>
        <Grid container spacing={2} alignItems="flex-end" style={{ marginBottom: 16 }}>
          {clusters.data && clusters.data.length > 1 && (
            <Grid item xs={12} sm={4} md={2}>
              <Select
                label="Cluster"
                items={clusters.data.map(c => ({ label: c.name, value: c.name }))}
                selected={cluster ?? ''}
                onChange={v => setChosen({ cluster: String(v), namespace: undefined })}
              />
            </Grid>
          )}
          <Grid item xs={12} sm={4} md={2}>
            <Select
              label="Namespace"
              disabled={!clusterInfo}
              items={(clusterInfo?.namespaces ?? []).map(ns => ({ label: ns, value: ns }))}
              selected={namespace ?? ''}
              onChange={v => setChosen({ cluster, namespace: String(v) })}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <Select
              label="State"
              items={FILTERS.map(f => ({ label: f[0].toUpperCase() + f.slice(1), value: f }))}
              selected={filter}
              onChange={v => setFilter(v as Filter)}
            />
          </Grid>
          <Grid item style={{ marginLeft: 'auto' }}>
            <Link to={workflowsLink({ cluster, namespace })}>Workflows</Link>
          </Grid>
        </Grid>
        {clusters.error && <p role="alert">{clusters.error}</p>}
        {list.error && <p role="alert">Could not load schedules: {list.error}</p>}
        {list.loading && !list.data && <p>Loading schedules…</p>}
        {list.data && shown.length === 0 && <p>No schedules match these filters.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {shown.map(s => (
            <ScheduleCard key={s.scheduleId} item={s} cluster={cluster!} namespace={namespace!} owner={owners.get(s.scheduleId)} />
          ))}
        </div>
      </Content>
    </Page>
  );
}
