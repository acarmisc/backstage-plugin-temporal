/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import type { Entity } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { ClusterSummary, StreamSummary, WorkflowGraph } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';

export const ANNOTATIONS = {
  cluster: 'temporal.io/cluster',
  namespace: 'temporal.io/namespace',
  stream: 'temporal.io/stream',
  definitionLocation: 'temporal.io/definition-location',
} as const;

/** Entities that have a Temporal stream. Used as the filter of the tab and the card. */
export const hasTemporalStream = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.[ANNOTATIONS.stream]);

/** The stream an entity points at, with its summary from the backend. */
export function useEntityStream() {
  const { entity } = useEntity();
  const api = useTemporalApi();
  const annotations = entity.metadata.annotations ?? {};
  const clusters = useLoad(() => api.get<ClusterSummary[]>('/clusters'), [api]);

  const cluster = annotations[ANNOTATIONS.cluster] ?? clusters.data?.[0]?.name;
  const namespace =
    annotations[ANNOTATIONS.namespace] ?? clusters.data?.find(c => c.name === cluster)?.namespaces[0];
  const stream = annotations[ANNOTATIONS.stream];

  const streams = useLoad(
    () => (cluster && namespace ? api.get<StreamSummary[]>('/streams', { cluster, namespace }) : Promise.resolve([])),
    [api, cluster, namespace],
  );
  const summary = streams.data?.find(s => s.name === stream);
  return {
    cluster,
    namespace,
    stream,
    summary,
    definitionLocation: annotations[ANNOTATIONS.definitionLocation],
    loading: clusters.loading || streams.loading,
    error: clusters.error ?? streams.error,
  };
}

/** A workflow definition from a repository, read by the backend. */
export function useDefinition(location: string | undefined) {
  const api = useTemporalApi();
  return useLoad<WorkflowGraph | undefined>(
    () => (location ? api.get<WorkflowGraph>('/definitions', { location }) : Promise.resolve(undefined)),
    [api, location],
  );
}
