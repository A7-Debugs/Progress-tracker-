import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';

type ToastKind = 'success' | 'info' | 'error' | 'xp';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<(message: string, kind?: ToastKind, action?: Toast['action']) => void>(() => {});
const ICONS = { success: CheckCircle2, info: Info, error: AlertTriangle, xp: Sparkles };
const COLORS = { success: 'text-success', info: 'text-info', error: 'text-danger', xp: 'text-xp' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: ToastKind = 'success', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, kind, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 2800);
  }, []);
  return (
    <ToastContext value={push}>
      {children}
      <div className="fixed bottom-[calc(132px+env(safe-area-inset-bottom))] md:bottom-6 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} role="status" className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-fg text-bg px-3.5 py-2.5 shadow-[var(--shadow-lg)] animate-slide-up max-w-[92vw]">
              <Icon size={16} className={COLORS[t.kind]} />
              <span className="text-[13px] font-medium truncate">{t.message}</span>
              {t.action && (
                <button
                  className="ml-1 text-[13px] font-semibold text-accent"
                  onClick={() => {
                    t.action!.run();
                    setToasts((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  return use(ToastContext);
}
