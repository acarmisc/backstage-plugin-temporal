/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ScheduleSpecView } from '@acarmisc/backstage-plugin-temporal-common';

/** `12s`, `3m 4s`, `1h 2m`. Undefined (a run that has not closed) shows as a dash. */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined) return '—';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** `in 5m`, `2h ago`, `just now`. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const s = Math.round(Math.abs(diff) / 1000);
  if (s < 45) return 'just now';
  const [n, unit] =
    s < 3600 ? [Math.round(s / 60), 'm'] : s < 86400 ? [Math.round(s / 3600), 'h'] : [Math.round(s / 86400), 'd'];
  return diff > 0 ? `in ${n}${unit}` : `${n}${unit} ago`;
}

type Range = { start: number; end: number; step?: number };
const FULL: Record<string, [number, number]> = { minute: [0, 59], hour: [0, 23], dayOfMonth: [1, 31], month: [1, 12], dayOfWeek: [0, 6] };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cronField(ranges: Range[] | undefined, name: string): string {
  const [lo, hi] = FULL[name];
  if (!ranges?.length) return name === 'minute' || name === 'hour' ? '0' : '*';
  if (ranges.some(r => r.start <= lo && r.end >= hi && !(r.step && r.step > 1))) return '*';
  return ranges
    .map(r => {
      const base = r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`;
      return r.step && r.step > 1 ? `${base === `${r.start}` ? r.start : base}/${r.step}` : base;
    })
    .join(',');
}

function calendarText(calendar: Record<string, unknown>): string {
  const f = (name: string) => cronField(calendar[name] as Range[] | undefined, name);
  const [minute, hour, dom, month, dow] = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'].map(f);
  const plain = /^\d+$/;
  if (plain.test(minute) && plain.test(hour) && dom === '*' && month === '*') {
    const at = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    if (dow === '*') return `Daily at ${at}`;
    if (/^[\d,]+$/.test(dow)) return `${dow.split(',').map(d => DAYS[Number(d) % 7]).join(', ')} at ${at}`;
  }
  const everyMinutes = /^\*\/(\d+)$/;
  if (everyMinutes.test(minute) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Every ${minute.match(everyMinutes)![1]} minutes`;
  }
  return `cron ${minute} ${hour} ${dom} ${month} ${dow}`;
}

function intervalText(every: string): string {
  const ms = parseInt(every, 10);
  const [n, unit] =
    ms % 864e5 === 0 ? [ms / 864e5, 'day'] : ms % 36e5 === 0 ? [ms / 36e5, 'hour'] : ms % 6e4 === 0 ? [ms / 6e4, 'minute'] : [ms / 1000, 'second'];
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}

/** Human-readable cadence of a schedule spec. Falls back to a cron string for unusual calendars. */
export function cadenceText(spec: ScheduleSpecView): string {
  const parts = [
    ...(spec.cronExpressions ?? []),
    ...(spec.calendars ?? []).map(calendarText),
    ...(spec.intervals ?? []).map(i => intervalText(i.every)),
  ];
  if (parts.length === 0) return 'No cadence';
  return parts.join(' · ') + (spec.timezone ? ` (${spec.timezone})` : '');
}
