"use client";

import { useEffect, useRef } from "react";

/** Debounces a callback by `delayMs` — used for search-as-you-type inputs so every keystroke doesn't refetch. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // A ref, not useMemo — the timeout id is mutable interaction state (which
  // pending call is in flight), not a value derived from render, so it
  // belongs in a ref the same way any other imperative timer handle does.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (...args: Args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
  };
}
