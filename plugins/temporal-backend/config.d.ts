/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

export interface Config {
  temporal?: {
    /** Temporal clusters to read from. Only the listed namespaces are visible. */
    clusters?: Array<{
      /** Logical id, shown in the UI and used in annotations. */
      name: string;
      /** Frontend gRPC address, e.g. temporal-frontend.temporal.svc:7233 */
      address: string;
      /** Allow-list: the plugin never shows other namespaces. */
      namespaces: string[];
      tls?: {
        enabled: boolean;
        /** Override the TLS server name (SNI). */
        serverName?: string;
        /** PEM-encoded root CA certificate. */
        caData?: string;
      };
      /** API key for Temporal Cloud. Requires TLS. @visibility secret */
      apiKey?: string;
      /** Base URL of the Temporal web UI, for "open in Temporal" links. */
      uiBaseUrl?: string;
      /** Workflow id prefix that identifies a stream. Default: "stream/" */
      streamPrefix?: string;
      /** Workflow types that count as streams. Default: ["StreamWorkflow"] */
      workflowTypes?: string[];
    }>;
    cache?: {
      /** Visibility queries are cached this long. Default: 10 */
      ttlSeconds?: number;
    };
    redaction?: {
      /** Regular expressions whose matches are replaced in task output and errors. */
      patterns?: string[];
      /** Maximum length of task output shown in the UI. Default: 2000 */
      maxTailLength?: number;
    };
  };
}
