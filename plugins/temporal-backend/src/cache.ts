/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

/**
 * Short-lived cache with in-flight de-duplication: concurrent callers share one
 * load, so a page refresh does not hit Temporal's visibility store N times.
 * Failed loads are not cached.
 */
export class TtlCache {
  private readonly entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.now()) {
      return existing.value as Promise<T>;
    }
    const value = load();
    this.entries.set(key, { expiresAt: this.now() + this.ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) {
        this.entries.delete(key);
      }
    });
    return value;
  }
}
