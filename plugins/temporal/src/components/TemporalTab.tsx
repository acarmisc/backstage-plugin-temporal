/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { streamLink } from './links';
import { RunDetail } from './RunDetail';
import { FreshnessBadge, RunStatusBadge } from './StatusBadge';
import { useDefinition, useEntityStream } from './entity';
import { WorkflowDiagram } from './WorkflowDiagram';
import { useIsDark } from './useIsDark';

/** Entity tab: the stream's state, its latest run, and the definition from the repository. */
export function TemporalTab() {
  const entity = useEntityStream();
  const definition = useDefinition(entity.definitionLocation);
  const dark = useIsDark();

  if (entity.error) return <p role="alert">Temporal is unavailable: {entity.error}</p>;
  if (entity.loading) return <p>Loading…</p>;
  if (!entity.stream || !entity.cluster || !entity.namespace) {
    return <p>Missing temporal.io annotations.</p>;
  }

  const { summary } = entity;
  return (
    <div>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>{entity.stream}</strong>
        {summary?.lastRun ? <RunStatusBadge status={summary.lastRun.status} /> : <span>no runs</span>}
        <FreshnessBadge lastSuccessAt={summary?.lastSuccess?.startTime} />
        <a href={streamLink({ cluster: entity.cluster, namespace: entity.namespace, name: entity.stream })}>
          All runs
        </a>
      </p>

      {summary?.lastRun && (
        <RunDetail cluster={entity.cluster} namespace={entity.namespace} workflowId={summary.lastRun.workflowId} />
      )}

      {definition.error && <p role="alert">Definition: {definition.error}</p>}
      {definition.data && (
        <div style={{ height: 420, marginTop: 16 }}>
          <h4>Definition</h4>
          <WorkflowDiagram graph={definition.data} dark={dark} />
        </div>
      )}
    </div>
  );
}
