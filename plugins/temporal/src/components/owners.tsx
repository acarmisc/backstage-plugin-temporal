/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { CATALOG_FILTER_EXISTS, catalogApiRef, humanizeEntityRef } from '@backstage/plugin-catalog-react';
import { ANNOTATIONS } from './entity';

export interface StreamOwner {
  ownerRef: string;
  entityRef: string;
}
export type StreamOwners = Map<string, StreamOwner>;

const EMPTY: StreamOwners = new Map();

/**
 * Owners of the catalog Components that carry `temporal.io/stream`, by stream name.
 * Fails soft: any catalog error (or denial) yields an empty map and no banner.
 * shortcut: cluster/namespace annotations are ignored, so two entities for the same
 * stream name in different clusters collide (last wins); upgrade if that happens.
 */
export function useStreamOwners(): StreamOwners {
  const catalog = useApi(catalogApiRef);
  const [owners, setOwners] = useState(EMPTY);
  useEffect(() => {
    let cancelled = false;
    catalog
      .getEntities({
        filter: { [`metadata.annotations.${ANNOTATIONS.stream}`]: CATALOG_FILTER_EXISTS },
        fields: ['kind', 'metadata.name', 'metadata.namespace', 'metadata.annotations', 'spec.owner'],
      })
      .then(({ items }) => {
        const map: StreamOwners = new Map();
        for (const e of items) {
          const stream = e.metadata.annotations?.[ANNOTATIONS.stream];
          const owner = typeof e.spec?.owner === 'string' ? e.spec.owner : undefined;
          if (!stream || !owner) continue;
          const ownerRef = stringifyEntityRef(
            parseEntityRef(owner, { defaultKind: 'Group', defaultNamespace: e.metadata.namespace }),
          );
          map.set(stream, { ownerRef, entityRef: stringifyEntityRef(e) });
        }
        if (!cancelled) setOwners(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [catalog]);
  return owners;
}

/**
 * Owner of a workflow id: `<prefix><name>`, `<prefix><name>/<timestamp>` or
 * `<prefix><name>-<RFC 3339 UTC>`. The prefix is unknown here, so the longest known
 * stream name that sits in the id at a segment boundary wins. Schedule ids are matched
 * by equality with the stream name (best effort).
 */
export function ownerOf(owners: StreamOwners, id: string): StreamOwner | undefined {
  let best: string | undefined;
  for (const name of owners.keys()) {
    const at = id.indexOf(name);
    if (at !== 0 && id[at - 1] !== '/') continue;
    const next = id.slice(at + name.length);
    if (!(next === '' || next[0] === '/' || /^-\d{4}-\d{2}-\d{2}T/.test(next))) continue;
    if (best === undefined || name.length > best.length) best = name;
  }
  return best === undefined ? undefined : owners.get(best);
}

/** Owner as text, or "—" when the stream has no catalog owner. */
export function OwnerText({ owner }: { owner?: StreamOwner }) {
  return <>{owner ? humanizeEntityRef(parseEntityRef(owner.ownerRef), { defaultKind: 'Group' }) : '—'}</>;
}
