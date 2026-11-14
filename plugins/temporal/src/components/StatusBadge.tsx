/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { ageText, freshnessOf, type RunStatus, type StageState } from '@acarmisc/backstage-plugin-temporal-common';

const RUN_COLORS: Record<RunStatus, string> = {
  RUNNING: '#3b82f6',
  COMPLETED: '#16a34a',
  FAILED: '#dc2626',
  CANCELED: '#64748b',
  TERMINATED: '#64748b',
  CONTINUED_AS_NEW: '#3b82f6',
  TIMED_OUT: '#dc2626',
  UNKNOWN: '#64748b',
};

const STAGE_COLORS: Record<StageState, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  ok: '#16a34a',
  warn: '#d97706',
  failed: '#dc2626',
  retrying: '#ea580c',
  'waiting-approval': '#f59e0b',
};

function Pill({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: color,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Pill color={RUN_COLORS[status]}>{status}</Pill>;
}

export function StageStateBadge({ state }: { state: StageState }) {
  return <Pill color={STAGE_COLORS[state]}>{state}</Pill>;
}

const FRESH_COLORS = { fresh: '#16a34a', stale: '#d97706', old: '#dc2626', never: '#64748b' } as const;

/** Age of the last success, coloured by the freshness thresholds. */
export function FreshnessBadge({ lastSuccessAt }: { lastSuccessAt?: string }) {
  const { freshness, ageHours } = freshnessOf(lastSuccessAt);
  if (freshness === 'never') {
    return <Pill color={FRESH_COLORS.never}>no success yet</Pill>;
  }
  return (
    <Pill color={FRESH_COLORS[freshness]} title={`last success ${lastSuccessAt}`}>
      {ageText(ageHours!)}
    </Pill>
  );
}
