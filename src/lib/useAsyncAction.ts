"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wraps an async handler so UI can disable buttons and show loading until the promise settles.
 * Re-entrancy is blocked while a call is in flight.
 */
export function useAsyncAction<T extends (...args: never[]) => Promise<unknown>>(
  action: T
): [(...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined>, boolean] {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (...args: Parameters<T>) => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(true);
      try {
        return (await action(...args)) as Awaited<ReturnType<T>>;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [action]
  );

  return [run, pending];
}
