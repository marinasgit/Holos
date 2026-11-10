import { useCallback, useEffect, useRef, useState } from 'react';

interface Result<T> {
  key: string;
  version: number;
  data: T | null;
  error: string | null;
}

/**
 * Load async data and re-load whenever `deps` change. Returns loading/error state and
 * reload() for pull-to-refresh. Old data stays visible while a reload is in flight.
 */
export function useLoader<T>(load: () => Promise<T>, deps: readonly unknown[], enabled = true) {
  const key = JSON.stringify(deps);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  // Always call the latest `load` without making it an effect dependency.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (!cancelled) setResult({ key, version, data, error: null });
      },
      (err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err.message : String(err);
        setResult((prev) => ({ key, version, data: prev?.key === key ? prev.data : null, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, version, enabled]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = result?.key === key ? result : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && (current === null || current.version !== version),
    reload,
  };
}
