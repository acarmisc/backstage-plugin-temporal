/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

export { temporalPlugin, temporalPlugin as default } from './plugin';
export { TemporalService, streamNameOf } from './service';
export { deriveStages } from './history';
export type { DeriveInput, HistoryEvent, PendingActivity } from './history';
export { createRedactor, DEFAULT_REDACTION_PATTERNS } from './redact';
export { readTemporalConfig } from './config';
export type { ClusterConfig, TemporalConfig } from './config';
