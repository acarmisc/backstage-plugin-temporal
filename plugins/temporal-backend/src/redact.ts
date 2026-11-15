/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Defaults for secrets that commonly show up in task output and error messages.
// Overridable with temporal.redaction.patterns.
export const DEFAULT_REDACTION_PATTERNS = [
  // key=value or key: value for common secret names
  '(password|passwd|secret|token|api[_-]?key|access[_-]?key|authorization)\\s*[:=]\\s*\\S+',
  // bearer tokens
  'bearer\\s+[A-Za-z0-9._~+/-]+=*',
  // well-known token prefixes (GitHub, GitLab, Slack, AWS access key ids)
  '(ghp_|github_pat_|glpat-|xox[abprs]-|AKIA)[A-Za-z0-9_-]{8,}',
];

const MASK = '[REDACTED]';
const SENSITIVE_KEY = /(token|secret|password|passwd|key|credential|auth)/i;

export interface Redactor {
  /** Redacts secrets, then truncates to `maxLength` characters. */
  text(value: string | undefined): string | undefined;
  /** Masks the values of parameters whose key looks sensitive. */
  params(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined;
  /** Copies a value, masking sensitive keys and secret patterns in strings. No truncation. */
  deep(value: unknown): unknown;
}

export function createRedactor(options: {
  patterns?: string[];
  maxLength?: number;
} = {}): Redactor {
  const regexes = (options.patterns ?? DEFAULT_REDACTION_PATTERNS).map(
    pattern => new RegExp(pattern, 'gi'),
  );
  const maxLength = options.maxLength ?? 2000;
  const mask = (value: string) =>
    regexes.reduce((result, regex) => result.replace(regex, MASK), value);
  const deep = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return mask(value);
    }
    if (Array.isArray(value)) {
      return value.map(deep);
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? MASK : deep(item),
      ]),
    );
  };

  return {
    text(value) {
      if (value === undefined) {
        return undefined;
      }
      const result = mask(value);
      return result.length > maxLength
        ? `${result.slice(0, maxLength)}… [truncated]`
        : result;
    },
    deep,
    params(value) {
      if (value === undefined) {
        return undefined;
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          SENSITIVE_KEY.test(key) ? MASK : item,
        ]),
      );
    },
  };
}
