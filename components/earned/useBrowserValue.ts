"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => undefined;

/**
 * A value only the browser knows (time zone, display mode). Prerendered HTML uses `serverValue`;
 * after hydration the real value is read without a mismatch warning.
 */
export function useBrowserValue<T extends string | number | boolean>(read: () => T, serverValue: T, subscribe: (cb: () => void) => () => void = noop): T {
  return useSyncExternalStore(subscribe, read, () => serverValue);
}
