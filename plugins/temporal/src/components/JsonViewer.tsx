/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, type ReactNode } from 'react';
import { useIsDark } from './useIsDark';

type Token = 'key' | 'string' | 'number' | 'literal';
type Palette = Record<Token | 'text' | 'muted' | 'bg', string>;

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: { key: '#7dd3fc', string: '#86efac', number: '#fdba74', literal: '#f0abfc', text: '#e2e8f0', muted: '#64748b', bg: '#0f172a' },
  light: { key: '#0369a1', string: '#15803d', number: '#c2410c', literal: '#a21caf', text: '#0f172a', muted: '#94a3b8', bg: '#f8fafc' },
};

// Groups: a string (followed by a colon when it is a key), a number, or true/false/null.
const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(?:true|false|null)\b/g;

/** Pretty JSON. A string that is itself JSON (a payload sent as text) is parsed first. */
function prettify(value: unknown): string {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      // Not JSON: show the string as it is.
    }
  }
  return JSON.stringify(parsed, null, 2) ?? 'undefined';
}

function tokenOf(str?: string, colon?: string, num?: string): Token {
  if (str === undefined) return num === undefined ? 'literal' : 'number';
  return colon ? 'key' : 'string';
}

/** Splits one line into coloured spans. React escapes the text, so no raw HTML is ever built. */
function highlight(line: string, palette: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const [text, str, colon, num] = match;
    const start = match.index ?? 0;
    if (start > last) out.push(line.slice(last, start));
    const token = tokenOf(str, colon, num);
    out.push(
      <span key={start} data-token={token} style={{ color: palette[token] }}>
        {str ?? text}
      </span>,
    );
    if (colon) out.push(colon);
    last = start + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Read-only JSON with line numbers, syntax colours and a copy button. */
export function JsonViewer({ value }: { value: unknown }) {
  const palette = PALETTES[useIsDark() ? 'dark' : 'light'];
  const text = useMemo(() => prettify(value), [value]);
  return (
    <div style={{ position: 'relative', background: palette.bg, color: palette.text, borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(text)?.catch(() => undefined)}
        style={{ position: 'absolute', top: 6, right: 6, fontSize: 12 }}
      >
        Copy
      </button>
      <div style={{ overflowX: 'auto', padding: '8px 0' }}>
        {text.split('\n').map((line, index) => (
          <div key={index} style={{ display: 'flex', lineHeight: '18px' }}>
            <span style={{ flex: '0 0 44px', textAlign: 'right', paddingRight: 12, color: palette.muted, userSelect: 'none' }}>
              {index + 1}
            </span>
            <span style={{ whiteSpace: 'pre' }}>{highlight(line, palette)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
