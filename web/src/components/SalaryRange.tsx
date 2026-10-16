import { tk, tkK } from "@/lib/format";
import type { CellStats } from "@/lib/benchmark";

/** Payslip-style range: P10-P90 band, middle half highlighted, median tick, and a gold "you" marker. */
export function SalaryRange({ stats, you, youLabel = "You" }: { stats: CellStats; you?: number; youLabel?: string }) {
  const lo = Math.min(stats.p10 * 0.85, you ? you * 0.92 : Infinity);
  const hi = Math.max(stats.p90 * 1.1, you ? you * 1.08 : 0);
  const pos = (v: number) => ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100;
  const x = (v: number) => `${pos(v)}%`;
  const youPos = you && you > 0 ? pos(you) : null;
  const marks = [
    { v: stats.p25, l: "Lower" },
    { v: stats.p50, l: "Typical" },
    { v: stats.p75, l: "Upper" },
  ];
  return (
    <figure
      className="w-full"
      aria-label={`Fair range ${tk(stats.p25)} to ${tk(stats.p75)}, typical ${tk(stats.p50)}${you ? `; you ${tk(you)}` : ""}`}
    >
      <div className="relative h-[72px]">
        {youPos !== null && (
          <div
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${youPos}%`, transform: `translateX(-${Math.min(Math.max(youPos, 8), 92)}%)` }}
          >
            <span className="num text-xs font-semibold whitespace-nowrap rounded bg-gold-2 text-[#141b2d] px-1.5 py-0.5">
              {youLabel} {tkK(you!)}
            </span>
          </div>
        )}
        {youPos !== null && <span className="absolute top-6 h-10 w-0.5 bg-gold-2 -translate-x-1/2" style={{ left: `${youPos}%` }} />}
        <div className="absolute left-0 right-0 top-9 h-4 rounded-full bg-surface-2" />
        <div className="absolute top-9 h-4 rounded-full bg-[color-mix(in_srgb,var(--series-1)_22%,transparent)]" style={{ left: x(stats.p10), width: `calc(${x(stats.p90)} - ${x(stats.p10)})` }} />
        <div className="absolute top-9 h-4 rounded-full bg-[var(--series-1)]" style={{ left: x(stats.p25), width: `calc(${x(stats.p75)} - ${x(stats.p25)})` }} />
        <div className="absolute top-8 h-6 w-[3px] rounded bg-ink -translate-x-1/2" style={{ left: x(stats.p50) }} />
      </div>
      <div className="relative h-9 text-xs text-ink-2">
        {marks.map((m) => (
          <div key={m.l} className="absolute -translate-x-1/2 text-center leading-tight" style={{ left: x(m.v) }}>
            <span className={`num block ${m.l === "Typical" ? "font-semibold text-ink" : ""}`}>{tkK(m.v)}</span>
            <span className="text-muted">{m.l}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
