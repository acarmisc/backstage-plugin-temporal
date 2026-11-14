/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { ageText, freshnessOf } from './freshness';

const now = new Date('2026-11-15T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe('freshnessOf', () => {
  it('is never when there was no success', () => {
    expect(freshnessOf(undefined, now).freshness).toBe('never');
  });

  it('classifies by age against the thresholds', () => {
    expect(freshnessOf(hoursAgo(3), now).freshness).toBe('fresh');
    expect(freshnessOf(hoursAgo(30), now).freshness).toBe('stale');
    expect(freshnessOf(hoursAgo(72), now)).toMatchObject({ freshness: 'old', ageHours: 72 });
  });

  it('accepts custom thresholds', () => {
    expect(freshnessOf(hoursAgo(5), now, { warnHours: 4, failHours: 6 }).freshness).toBe('stale');
  });
});

describe('ageText', () => {
  it('reads naturally at each scale', () => {
    expect(ageText(0.2)).toBe('just now');
    expect(ageText(3.9)).toBe('3 h ago');
    expect(ageText(72)).toBe('3 d ago');
  });
});
