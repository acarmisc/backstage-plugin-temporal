/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useState } from 'react';
import type { RunDetail as RunDetailData, StageRunState } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { useIsDark } from './useIsDark';
import { WorkflowDiagram } from './WorkflowDiagram';
import { RunStatusBadge, StageStateBadge } from './StatusBadge';

const LIVE_INTERVAL_MS = 5000;

const cell = { padding: '4px 8px', borderBottom: '1px solid rgba(128,128,128,0.25)', verticalAlign: 'top' as const };

/**
 * One run: the definition with each stage's state overlaid, and a table with the
 * details. Re-reads every few seconds while the run is RUNNING.
 */
export function RunDetail({
  cluster,
  namespace,
  workflowId,
}: {
  cluster: string;
  namespace: string;
  workflowId: string;
}) {
  const api = useTemporalApi();
  const dark = useIsDark();
  const [live, setLive] = useState<number>();
  const { data, error, loading, reload } = useLoad(
    () => api.get<RunDetailData>(`/runs/${workflowId}`, { cluster, namespace }),
    [api, cluster, namespace, workflowId],
    live,
  );

  useEffect(() => {
    setLive(data?.status === 'RUNNING' ? LIVE_INTERVAL_MS : undefined);
  }, [data?.status]);

  if (error) return <p role="alert">Could not load the run: {error}</p>;
  if (!data) return loading ? <p>Loading run…</p> : null;

  const states = Object.fromEntries(data.stages.map((s: StageRunState) => [s.stage, s.state]));
  return (
    <div>
      <p style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <RunStatusBadge status={data.status} />
        <code>{data.workflowId}</code>
        <span>started {new Date(data.startTime).toLocaleString()}</span>
        {data.durationSeconds !== undefined && <span>· {data.durationSeconds}s</span>}
        {data.status === 'RUNNING' && <span>· live</span>}
        {data.uiUrl && (
          <a href={data.uiUrl} target="_blank" rel="noreferrer">
            Open in Temporal
          </a>
        )}
        <button type="button" onClick={reload}>Refresh</button>
      </p>

      {data.degraded && (
        <p role="note">
          Stages were matched by position: the payloads are not readable JSON (custom data converter).
        </p>
      )}

      {data.graph && (
        <div style={{ height: 420, marginBottom: 16 }}>
          <WorkflowDiagram graph={data.graph} states={states} dark={dark} />
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={cell}>Stage</th>
            <th style={cell}>State</th>
            <th style={cell}>Attempt</th>
            <th style={cell}>Exit</th>
            <th style={cell}>Seconds</th>
            <th style={cell}>Error / output</th>
          </tr>
        </thead>
        <tbody>
          {data.stages.map(stage => (
            <tr key={stage.stage} data-testid={`run-stage-${stage.stage}`}>
              <td style={cell}>
                {stage.stage}
                {stage.optional && <small> (optional)</small>}
              </td>
              <td style={cell}>
                <StageStateBadge state={stage.state} />
              </td>
              <td style={cell}>{stage.attempt ?? '—'}</td>
              <td style={cell}>{stage.exit ?? '—'}</td>
              <td style={cell}>{stage.seconds ?? '—'}</td>
              <td style={cell}>
                {stage.error && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{stage.error}</pre>}
                {stage.tail && <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 160, overflow: 'auto' }}>{stage.tail}</pre>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
