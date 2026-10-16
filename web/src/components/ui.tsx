"use client";

import { useId, type ReactNode } from "react";

export function PageTitle({ eyebrow, title, bn, children }: { eyebrow?: string; title: string; bn?: string; children?: ReactNode }) {
  return (
    <div className="mb-7 sm:mb-9 max-w-3xl">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{title}</h1>
      {bn && <p className="text-ink-2 mt-1.5">{bn}</p>}
      {children && <div className="text-ink-2 mt-3 leading-relaxed">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, eyebrow, aside }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; aside?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-6 ${className}`}>
      {(title || aside || eyebrow) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="font-serif text-lg font-semibold leading-snug">{title}</h2>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const controlClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base sm:text-sm text-ink focus:border-gold-2 focus:outline-none";

export function Select<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} className={controlClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function NumberInput({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex items-stretch rounded-lg border border-line bg-surface focus-within:border-gold-2">
          {prefix && <span className="px-3 flex items-center text-muted border-r border-line num">{prefix}</span>}
          <input
            id={id}
            type="number"
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent px-3 py-2.5 text-base sm:text-sm num focus:outline-none"
            value={Number.isFinite(value) ? value : ""}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              onChange(Number.isFinite(v) ? Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, v)) : min);
            }}
          />
          {suffix && <span className="px-3 flex items-center text-muted border-l border-line text-sm whitespace-nowrap">{suffix}</span>}
        </div>
      )}
    </Field>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" className="h-4 w-4 accent-[var(--gold-2)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" | "gold" }) {
  const color = tone ? { good: "text-good", bad: "text-bad", warn: "text-warn", gold: "text-gold" }[tone] : "text-ink";
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className={`num text-xl sm:text-2xl font-semibold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ink-2 mt-0.5">{sub}</p>}
    </div>
  );
}

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { cls: "bg-good-soft text-good", label: "Well sourced", dots: "●●●" },
    medium: { cls: "bg-warn-soft text-warn", label: "Some data", dots: "●●○" },
    low: { cls: "bg-bad-soft text-bad", label: "Rough estimate", dots: "●○○" },
  } as const;
  const m = map[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`} title={`Data confidence: ${level}`}>
      <span aria-hidden className="tracking-tighter">{m.dots}</span>
      {m.label}
    </span>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "gold" }) {
  const cls = { info: "bg-surface-2 text-ink-2", warn: "bg-warn-soft text-ink", gold: "bg-gold-soft text-ink" }[tone];
  return <div className={`rounded-lg px-3.5 py-3 text-sm leading-relaxed ${cls}`}>{children}</div>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-line p-0.5 bg-surface-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm rounded-md ${value === o.value ? "bg-surface shadow-sm font-medium text-ink" : "text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, onClick, disabled, variant = "primary", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost"; type?: "button" | "submit" }) {
  const cls = variant === "primary" ? "bg-brand text-brand-ink hover:opacity-90" : "border border-line bg-surface text-ink hover:bg-surface-2";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${cls}`}>
      {children}
    </button>
  );
}
