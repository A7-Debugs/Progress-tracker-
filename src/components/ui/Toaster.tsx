import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { CheckCircle2, Trophy, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'pr' | 'info' | 'warn';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  pr: Trophy,
  info: Info,
  warn: AlertTriangle,
};

const COLORS: Record<ToastKind, string> = {
  success: 'text-accent',
  pr: 'text-warn',
  info: 'text-info',
  warn: 'text-danger',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastContext value={push}>
      {children}
      <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 pt-[max(1rem,env(safe-area-inset-top))] px-4 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-center gap-2 rounded-full bg-base-850/95 backdrop-blur border border-base-700 px-4 py-2.5 shadow-2xl animate-slide-up max-w-[92vw]',
              )}
            >
              <Icon size={16} className={COLORS[t.kind]} />
              <span className="text-sm font-medium text-base-50 truncate">{t.message}</span>
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
