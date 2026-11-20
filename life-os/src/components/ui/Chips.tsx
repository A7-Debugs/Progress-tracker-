import { isValidElement, type ReactNode } from 'react';
import { Input, Textarea } from './Input';
import { cn } from '@/lib/cn';

/** Touch-friendly single-choice chips. */
export function Chips<T extends string | number>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; color?: string }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-xl border font-semibold transition-all active:scale-95',
              size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-3.5 text-sm',
              active ? 'border-accent bg-accent-bg text-accent' : 'border-base-700 bg-base-850 text-base-200',
            )}
            style={active && o.color ? { borderColor: o.color, color: o.color, background: `${o.color}1f` } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select day-of-week toggles (Mon first, UK style). */
export function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <div className="flex gap-1.5">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={full[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn('h-10 flex-1 rounded-xl text-sm font-bold border transition-all active:scale-95', on ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-400 border-base-700')}
          >
            {names[d]}
          </button>
        );
      })}
    </div>
  );
}

/** Labelled form row. Wraps a single input in <label>; anything else (chip groups, pickers) becomes a named group. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const isControl = isValidElement(children) && (children.type === Input || children.type === Textarea || children.type === 'input' || children.type === 'select');
  const body = (
    <>
      <span className="block text-sm font-semibold text-base-200 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-base-400 mt-1">{hint}</span>}
    </>
  );
  return isControl ? (
    <label className="block">{body}</label>
  ) : (
    <div className="block" role="group" aria-label={label}>
      {body}
    </div>
  );
}
