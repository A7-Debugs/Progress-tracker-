import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { verifyPasscode } from '@/lib/lock';
import type { Settings } from '@/lib/types';
import { Logo } from './layout';

const KEY = 'life-os:unlocked-at';

/** Locked on start and after `timeoutMin` in the background. Session-scoped, never persisted to disk. */
export function useLock(settings: Settings | undefined) {
  const enabled = !!settings?.lock.enabled;
  const timeout = (settings?.lock.timeoutMin ?? 5) * 60000;
  const [locked, setLocked] = useState(() => enabled && !recent(timeout));
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      return;
    }
    if (!recent(timeout)) setLocked(true);
    const vis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > timeout) setLocked(true);
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [enabled, timeout]);
  const unlock = useCallback(() => {
    sessionStorage.setItem(KEY, String(Date.now()));
    setLocked(false);
  }, []);
  return { locked: enabled && locked, unlock };
}

function recent(timeout: number) {
  try {
    const t = Number(sessionStorage.getItem(KEY));
    return t > 0 && Date.now() - t < timeout;
  } catch {
    return false;
  }
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  async function tryCode(c: string) {
    setBusy(true);
    const ok = await verifyPasscode(c);
    setBusy(false);
    if (ok) onUnlock();
    else {
      setErr(true);
      setCode('');
    }
  }
  const press = (k: string) => {
    if (busy) return;
    setErr(false);
    const next = k === '⌫' ? code.slice(0, -1) : (code + k).slice(0, 8);
    setCode(next);
  };
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-bg">
      <Logo size={40} />
      <p className="mt-4 text-sm font-medium text-fg inline-flex items-center gap-1.5">
        <Lock size={14} /> Enter your passcode
      </p>
      <div className="flex gap-2.5 my-5 h-3" aria-live="polite">
        {Array.from({ length: Math.max(4, code.length) }, (_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full border ${i < code.length ? 'bg-fg border-fg' : 'border-line-strong'}`} />
        ))}
      </div>
      {err && <p className="text-xs text-danger -mt-2 mb-3">Incorrect passcode</p>}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
          k ? (
            <button key={k} onClick={() => press(k)} className="h-14 rounded-full bg-surface border border-line text-lg font-medium text-fg active:bg-surface-3" aria-label={k === '⌫' ? 'Delete' : k}>
              {k}
            </button>
          ) : (
            <span key="blank" />
          ),
        )}
      </div>
      <button disabled={code.length < 4 || busy} onClick={() => tryCode(code)} className="mt-5 h-11 w-64 rounded-lg bg-accent text-accent-fg text-sm font-medium disabled:opacity-40">
        {busy ? 'Checking…' : 'Unlock'}
      </button>
    </div>
  );
}
