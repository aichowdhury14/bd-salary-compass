"use client";

import { useMemo, useState } from "react";
import { raiseCheck, takeHome, whatIf, LAST_YEAR_INFLATION, type WhatIfRow } from "@/lib/paycheck";
import { pct, signedPct, tk } from "@/lib/format";
import { peopleBelow, type CityId } from "@/lib/benchmark";
import { Card, NumberInput, Segmented } from "./ui";

// ---------------------------------------------------------------- 3. 100 dots
/** 100 people like you: the ones earning less are shaded, you are the gold dot. */
export function HundredDots({ percentile }: { percentile: number }) {
  const below = Math.max(0, Math.min(99, Math.round(percentile)));
  return (
    <figure aria-label={`Out of 100 people like you, ${peopleBelow(percentile)} earn less and ${100 - below - 1} earn more`} className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="grid grid-cols-10 gap-[5px] w-fit" aria-hidden>
        {Array.from({ length: 100 }, (_, i) => (
          <span
            key={i}
            className={`h-[11px] w-[11px] rounded-full ${i === below ? "bg-gold-2 ring-2 ring-gold-2/40 scale-125" : i < below ? "bg-[var(--series-1)]" : "bg-surface-2 border border-line"}`}
          />
        ))}
      </div>
      <figcaption className="text-sm text-ink-2 space-y-1.5 max-w-56">
        <p>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--series-1)] mr-1.5 align-middle" />
          <strong className="num text-ink">{peopleBelow(percentile)}</strong> earn less than you
        </p>
        <p>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold-2 mr-1.5 align-middle" />
          You
        </p>
        <p>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-surface-2 border border-line mr-1.5 align-middle" />
          <strong className="num text-ink">{100 - below - 1}</strong> earn more
        </p>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- 1. take-home line
export function TakeHomeLine({ monthlyGross }: { monthlyGross: number }) {
  const t = takeHome(monthlyGross);
  return (
    <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <span>
        <span className="eyebrow mr-2">In your account</span>
        <strong className="num text-ink text-base">{tk(t.takeHome)}</strong>
        <span className="text-ink-2"> a month after income tax ({tk(t.monthlyTax)})</span>
      </span>
      <span className="text-ink-2">
        <strong className="num text-ink">{tk(t.takeHomeWithPf)}</strong> if 10% provident fund is also deducted
      </span>
      <span className="text-xs text-muted w-full">Assumes basic = 60% of gross and two festival bonuses a year. See Take-home &amp; tax for your exact package.</span>
    </div>
  );
}

// ---------------------------------------------------------------- 2. what if
function Bars({ rows, max }: { rows: WhatIfRow[]; max: number }) {
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center">
          <div className="min-w-0">
            <p className={`text-sm truncate ${r.current ? "font-semibold text-ink" : "text-ink-2"}`}>
              {r.label}
              {r.current && <span className="ml-1.5 eyebrow !text-[0.6rem] text-gold">you</span>}
              {r.confidence === "low" && <span className="ml-1.5 text-xs text-muted">(rough)</span>}
            </p>
            <div className="mt-1 h-2 rounded-full bg-surface-2">
              <div className={`h-2 rounded-full ${r.current ? "bg-gold-2" : "bg-[var(--series-1)]"}`} style={{ width: `${Math.max(3, (r.typical / max) * 100)}%` }} />
            </div>
            {r.sub && <p className="text-xs text-muted truncate mt-0.5">{r.sub}</p>}
          </div>
          <div className="text-right">
            <p className="num text-sm font-medium">{tk(r.typical)}</p>
            {!r.current && (
              <p className={`num text-xs ${r.change > 0.005 ? "text-good" : r.change < -0.005 ? "text-bad" : "text-muted"}`}>{signedPct(r.change)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

type Lens = "employers" | "experience" | "cities";

export function WhatIfCard(props: { functionId: string; groupId: string; years: number; city: CityId; jobLabel: string }) {
  const [lens, setLens] = useState<Lens>("employers");
  const { functionId, groupId, years, city } = props;
  const w = useMemo(() => whatIf({ functionId, groupId, years, city }), [functionId, groupId, years, city]);
  const rows = w[lens];
  const max = Math.max(...rows.map((r) => r.typical));
  const best = [...rows].filter((r) => !r.current && r.confidence !== "low").sort((a, b) => b.typical - a.typical)[0];
  return (
    <Card
      eyebrow="What if"
      title="What would change your pay?"
      aside={
        <Segmented<Lens>
          label="Compare by"
          value={lens}
          onChange={setLens}
          options={[
            { value: "employers", label: "Employer" },
            { value: "experience", label: "Experience" },
            { value: "cities", label: "City" },
          ]}
        />
      }
    >
      <p className="text-sm text-ink-2 mb-4">
        Typical pay for a {props.jobLabel.toLowerCase()}
        {lens === "employers" ? " with your experience, at each kind of employer" : lens === "experience" ? " at your kind of employer as you gain experience" : " with your experience, in each location"}.
        {best && best.change > 0.05 && (
          <>
            {" "}
            The biggest jump: <strong className="text-ink">{best.label}</strong>, <span className="num text-good">{signedPct(best.change)}</span>.
          </>
        )}
      </p>
      <Bars rows={rows} max={max} />
      <p className="text-xs text-muted mt-3">
        {lens === "employers"
          ? "General trainee/officer and programme jobs are compared only within the same sector. “Rough” means few published figures for that combination."
          : lens === "cities"
            ? "City differences are assumptions, since most published figures are for Dhaka."
            : "In today's money, before any market-wide pay growth or inflation (see the forecast below)."}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------- 4. last raise vs inflation
export function RaiseCheckCard({ monthlyGross }: { monthlyGross: number }) {
  const [last, setLast] = useState(0);
  const r = raiseCheck(last, monthlyGross);
  const tone = r?.verdict === "beat" ? "text-good" : r?.verdict === "lost" ? "text-bad" : "text-gold";
  return (
    <Card eyebrow="Raise check" title="Did your last raise beat inflation?">
      <div className="grid sm:grid-cols-[260px_1fr] gap-5 items-start">
        <NumberInput label="Your monthly gross a year ago" value={last} onChange={setLast} prefix="৳" step={1000} hint={`Compared with your current ${tk(monthlyGross)}`} />
        {r ? (
          <div className="grid gap-3">
            <p className="font-serif text-xl font-semibold leading-snug">
              {r.verdict === "beat" ? "Yes, you came out ahead." : r.verdict === "kept_up" ? "You only just kept up." : "No. In real terms, you took a pay cut."}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="eyebrow">Your raise</p>
                <p className="num text-lg font-semibold">{signedPct(r.nominal, 1)}</p>
              </div>
              <div>
                <p className="eyebrow">Prices rose</p>
                <p className="num text-lg font-semibold text-warn">{pct(r.inflation, 1)}</p>
              </div>
              <div>
                <p className="eyebrow">Buying power</p>
                <p className={`num text-lg font-semibold ${tone}`}>{signedPct(r.real, 1)}</p>
              </div>
            </div>
            <p className="text-sm text-ink-2">
              {r.shortfall > 0
                ? `Just to keep up with prices you'd need ${tk(r.neededToKeepUp)}, which is ${tk(r.shortfall)} a month more than you earn now. Use that as the floor at your next appraisal.`
                : `To keep up with prices you needed at least ${tk(r.neededToKeepUp)}; you're ${tk(monthlyGross - r.neededToKeepUp)} a month above that.`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            Enter what you earned a year ago. Prices rose {pct(LAST_YEAR_INFLATION, 2)} in the past year (BBS), so a raise smaller than that is a
            real pay cut.
          </p>
        )}
      </div>
    </Card>
  );
}

