import { createContext, use, useMemo, type ReactNode } from 'react';
import type { Snapshot } from './snapshot';
import { useSnapshot } from './hooks';
import { xpLedger, type XpEntry } from './progression';

interface Store {
  s: Snapshot;
  ledger: XpEntry[];
}
const Ctx = createContext<Store | null>(null);

/** One live snapshot for the whole app: every screen reads the same, always-current data. */
export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const s = useSnapshot();
  const ledger = useMemo(() => (s ? xpLedger(s) : []), [s]);
  const value = useMemo(() => (s ? { s, ledger } : null), [s, ledger]);
  if (!value) return <>{fallback}</>;
  return <Ctx value={value}>{children}</Ctx>;
}

export function useStore(): Store {
  const v = use(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** Wraps an action so errors surface as a toast instead of being swallowed. */
export function guard<T extends unknown[]>(toast: (m: string, k?: 'error') => void, fn: (...a: T) => Promise<unknown>) {
  return async (...a: T) => {
    try {
      await fn(...a);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
      return false;
    }
  };
}
