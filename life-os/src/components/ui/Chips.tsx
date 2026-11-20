import { isValidElement, type ReactNode } from 'react';
import { Input, NumberField, Textarea } from './Input';
import { cn } from '@/lib/cn';

/** Segmented single choice. */
export function Segmented<T extends string | number>({ value, onChange, options, className, size = 'md' }: { value: T | null; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('rounded-lg border font-medium transition-colors', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-[13px]', active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg-2 hover:bg-surface-2')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select chips. */
export function MultiChips<T extends string>({ value, onChange, options, max }: { value: T[]; onChange: (v: T[]) => void; options: { value: T; label: ReactNode }[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        const disabled = !on && max !== undefined && value.length >= max;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            className={cn('h-9 px-3 rounded-lg border text-[13px] font-medium transition-colors disabled:opacity-40', on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg-2 hover:bg-surface-2')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select day-of-week toggles (Monday first). */
export function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <div className="flex gap-1">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button key={d} type="button" aria-pressed={on} aria-label={full[d]} onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())} className={cn('h-9 flex-1 rounded-lg text-[13px] font-semibold border transition-colors', on ? 'bg-accent text-accent-fg border-accent' : 'bg-surface text-fg-3 border-line')}>
            {names[d]}
          </button>
        );
      })}
    </div>
  );
}

/** Labelled form row. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const isControl = isValidElement(children) && (children.type === Input || children.type === Textarea || children.type === NumberField || children.type === 'input' || children.type === 'textarea');
  const body = (
    <>
      <span className="block text-[13px] font-medium text-fg-2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-fg-3 mt-1">{hint}</span>}
    </>
  );
  return isControl ? (
    <label className={cn('block', className)}>{body}</label>
  ) : (
    <div className={cn('block', className)} role="group" aria-label={label}>
      {body}
    </div>
  );
}
