import type { ReactNode } from 'react';
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { Comparison } from '@/lib/life/analytics';

export function ChartCard({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-base-50">{title}</p>
      <p className="text-[11px] text-base-500 mb-2">{sub}</p>
      {children}
    </Card>
  );
}

/** "On days you X, Y was …" findings — icon + label, never colour alone. */
export function Findings({ items, empty }: { items: Comparison[]; empty: string }) {
  if (!items.length) return <p className="text-xs text-base-500">{empty}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((x) => {
        const neutral = x.size < 0.05;
        const Icon = neutral ? MinusCircle : x.good ? CheckCircle2 : XCircle;
        return (
          <div key={x.key} className="flex gap-2.5">
            <Icon size={16} className={`shrink-0 mt-0.5 ${neutral ? 'text-base-500' : x.good ? 'text-accent' : 'text-warn'}`} aria-hidden />
            <div>
              <p className="text-sm font-semibold text-base-50">
                {x.title} <span className="text-[11px] font-normal text-base-500">· {neutral ? 'no clear difference' : x.good ? 'better' : 'worse'}</span>
              </p>
              <p className="text-xs text-base-400 leading-relaxed">{x.text}</p>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-base-500">From your own check-ins (last 90 days, sick days left out). Relationships, not proof of cause — they need 5+ days on each side to show.</p>
    </div>
  );
}

export function Delta({ cur, prev, unit = '', digits = 1, higherIsBetter = true }: { cur: number | null; prev: number | null; unit?: string; digits?: number; higherIsBetter?: boolean }) {
  if (cur === null || prev === null) return <span className="text-base-500">vs —</span>;
  const d = cur - prev;
  const good = d === 0 ? null : (d > 0) === higherIsBetter;
  return (
    <span className={good === null ? 'text-base-500' : good ? 'text-accent' : 'text-warn'}>
      {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(digits)}
      {unit} vs prior 30d
    </span>
  );
}
