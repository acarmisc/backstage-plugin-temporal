/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { Config } from '@backstage/config';
import { DEFAULT_REDACTION_PATTERNS } from './redact';

export interface ClusterConfig {
  name: string;
  address: string;
  namespaces: string[];
  tls: boolean;
  apiKey?: string;
  uiBaseUrl?: string;
  streamPrefix: string;
  workflowTypes: string[];
}

export interface TemporalConfig {
  clusters: ClusterConfig[];
  cacheTtlMs: number;
  redaction: { patterns: string[]; maxTailLength: number };
}

export function readTemporalConfig(config: Config): TemporalConfig {
  const root = config.getOptionalConfig('temporal');
  const clusters = (root?.getOptionalConfigArray('clusters') ?? []).map(
    (cluster): ClusterConfig => {
      const name = cluster.getString('name');
      const namespaces = cluster.getStringArray('namespaces');
      if (namespaces.length === 0) {
        throw new Error(`temporal cluster "${name}": namespaces must not be empty`);
      }
      return {
        name,
        address: cluster.getString('address'),
        namespaces,
        tls: cluster.getOptionalBoolean('tls.enabled') ?? false,
        apiKey: cluster.getOptionalString('apiKey'),
        uiBaseUrl: cluster.getOptionalString('uiBaseUrl'),
        streamPrefix: cluster.getOptionalString('streamPrefix') ?? 'stream/',
        workflowTypes: cluster.getOptionalStringArray('workflowTypes') ?? [
          'StreamWorkflow',
        ],
      };
    },
  );

  const names = clusters.map(cluster => cluster.name);
  if (new Set(names).size !== names.length) {
    throw new Error('temporal clusters must have unique names');
  }

  return {
    clusters,
    cacheTtlMs: (root?.getOptionalNumber('cache.ttlSeconds') ?? 10) * 1000,
    redaction: {
      patterns:
        root?.getOptionalStringArray('redaction.patterns') ?? DEFAULT_REDACTION_PATTERNS,
      maxTailLength: root?.getOptionalNumber('redaction.maxTailLength') ?? 2000,
    },
  };
}
