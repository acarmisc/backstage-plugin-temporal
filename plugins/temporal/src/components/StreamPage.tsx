/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, Header, Page } from '@backstage/core-components';
import type { RunSummary } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { RunDetail } from './RunDetail';
import { RunStatusBadge } from './StatusBadge';
import { streamLink, useUrlParams } from './links';

const cell = { padding: '4px 8px', borderBottom: '1px solid rgba(128,128,128,0.25)', textAlign: 'left' as const };

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

  return (
    <Page themeId="tool">
      <Header title={name || 'Stream'} subtitle={`${cluster} / ${namespace}`} />
      <Content>
        {runs.error && <p role="alert">Could not load runs: {runs.error}</p>}
        {runs.data && runs.data.length === 0 && <p>No runs yet.</p>}
        {runs.data && runs.data.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={cell}>Run</th>
                  <th style={cell}>Status</th>
                  <th style={cell}>Started</th>
                  <th style={cell}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map(run => (
                  <tr key={run.workflowId} style={{ background: run.workflowId === current ? 'rgba(59,130,246,0.1)' : undefined }}>
                    <td style={cell}>
                      <a href={streamLink({ cluster, namespace, name, run: run.workflowId })}>{run.workflowId.split('/').slice(2).join('/') || run.workflowId}</a>
                    </td>
                    <td style={cell}><RunStatusBadge status={run.status} /></td>
                    <td style={cell}>{new Date(run.startTime).toLocaleString()}</td>
                    <td style={cell}>{run.durationSeconds !== undefined ? `${run.durationSeconds}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {current && <RunDetail cluster={cluster} namespace={namespace} workflowId={current} />}
          </>
        )}
      </Content>
    </Page>
  );
}
