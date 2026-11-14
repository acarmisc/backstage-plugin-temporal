/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

export type Freshness = 'fresh' | 'stale' | 'old' | 'never';

/**
 * Age of the last successful run, in hours, against two thresholds.
 * Defaults are placeholders: the thresholds are an open decision (PLAN.md §11.4)
 * and will be configurable per stream.
 */
export const DEFAULT_FRESHNESS = { warnHours: 24, failHours: 48 };

export function freshnessOf(
  lastSuccessAt: string | undefined,
  now: Date = new Date(),
  thresholds = DEFAULT_FRESHNESS,
): { freshness: Freshness; ageHours?: number } {
  if (!lastSuccessAt) {
    return { freshness: 'never' };
  }
  const ageHours = (now.getTime() - new Date(lastSuccessAt).getTime()) / 3_600_000;
  if (ageHours >= thresholds.failHours) {
    return { freshness: 'old', ageHours };
  }
  if (ageHours >= thresholds.warnHours) {
    return { freshness: 'stale', ageHours };
  }
  return { freshness: 'fresh', ageHours };
}

/** "3 h ago", "2 d ago", "just now" */
export function ageText(ageHours: number): string {
  if (ageHours < 1) return 'just now';
  if (ageHours < 48) return `${Math.floor(ageHours)} h ago`;
  return `${Math.floor(ageHours / 24)} d ago`;
}
