/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, useState } from 'react';

export interface Loaded<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `load` when `deps` change and whenever `reload` is called. Stale results
 * from a previous request are ignored.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], intervalMs?: number): Loaded<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(result => {
        if (!cancelled) {
          setData(result);
          setError(undefined);
        }
      })
      .catch(err => {
        if (!cancelled) setError(String((err as Error).message));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // The caller owns the dependencies; `load` is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { data, error, loading, reload };
}
