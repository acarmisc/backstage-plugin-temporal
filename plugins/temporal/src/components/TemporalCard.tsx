/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { InfoCard } from '@backstage/core-components';
import { streamLink } from './links';
import { FreshnessBadge, RunStatusBadge } from './StatusBadge';
import { useEntityStream } from './entity';

/** Overview card: last run and freshness of the entity's stream. */
export function TemporalCard() {
  const entity = useEntityStream();
  return (
    <InfoCard title="Temporal stream">
      {entity.error && <p role="alert">{entity.error}</p>}
      {!entity.error && entity.loading && <p>Loading…</p>}
      {!entity.error && !entity.loading && entity.stream && (
        <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong>{entity.stream}</strong>
          {entity.summary?.lastRun ? <RunStatusBadge status={entity.summary.lastRun.status} /> : <span>no runs</span>}
          <FreshnessBadge lastSuccessAt={entity.summary?.lastSuccess?.startTime} />
          <a href={streamLink({ cluster: entity.cluster!, namespace: entity.namespace!, name: entity.stream })}>Open</a>
        </p>
      )}
    </InfoCard>
  );
}
