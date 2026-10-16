"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import cpi from "@/data/cpi.json";
import { cagr, forecast, type ForecastInput } from "@/lib/forecast";
import { pct, tk, tkShort } from "@/lib/format";
import { Card, Field, Segmented } from "./ui";

const axis = { stroke: "var(--axis)", tick: { fill: "var(--muted)", fontSize: 12, fontFamily: "var(--font-plex-mono)" }, tickLine: false };
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", fontSize: 13 },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--ink-2)" },
};

type Growth = "0" | "1" | "2";
const GROWTH_LABEL: Record<Growth, string> = { "0": "None (like 2022-26)", "1": "1% a year", "2": "2% a year" };

export function ForecastCard({ input }: { input: Omit<ForecastInput, "inflation" | "realGrowth"> }) {
  const [inflation, setInflation] = useState(6);
  const [growth, setGrowth] = useState<Growth>("1");
  const [view, setView] = useState<"nominal" | "real">("nominal");
  const f = useMemo(() => forecast({ ...input, inflation: inflation / 100, realGrowth: Number(growth) / 100 }), [input, inflation, growth]);

  const nominal = view === "nominal";
  const data = f.points.map((p) => ({
    t: p.t,
    year: p.year,
    you: nominal ? p.youNominal : p.youReal,
    market: nominal ? p.marketNominal : p.marketReal,
    low: nominal ? p.p25Nominal : p.p25Real,
    band: (nominal ? p.p75Nominal : p.p75Real) - (nominal ? p.p25Nominal : p.p25Real),
  }));
  const at10 = f.points[10];
  const realCagr10 = cagr(input.monthlyGross, at10.youReal, 10);
  const position = f.ratio >= 1 ? `${pct(f.ratio - 1)} above` : `${pct(1 - f.ratio)} below`;

  return (
    <Card
      eyebrow="Forecast"
      title="Your salary over the next 30 years"
      aside={
        <Segmented
          label="Money view"
          value={view}
          onChange={setView}
          options={[
            { value: "nominal", label: "Future taka" },
            { value: "real", label: "Today's money" },
          ]}
        />
      }
    >
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <Field label={`Inflation assumption: ${inflation}% a year`} hint={`${pct(cpi.latest_point_to_point.rate, 2)} in Sep 2026; it averaged about 6% in FY2016-22`}>
          {(id) => <input id={id} type="range" min={3} max={12} step={0.5} value={inflation} onChange={(e) => setInflation(Number(e.target.value))} className="w-full" />}
        </Field>
        <div className="grid gap-1.5 content-start">
          <span className="text-sm font-medium">Market pay growth above inflation</span>
          <Segmented<Growth> label="Real wage growth" value={growth} onChange={setGrowth} options={(["0", "1", "2"] as Growth[]).map((g) => ({ value: g, label: GROWTH_LABEL[g] }))} />
          <span className="text-xs text-muted">Recently, wages have only kept pace with prices</span>
        </div>
      </div>

      <div className="h-64 -ml-2">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="t" {...axis} ticks={[0, 5, 10, 15, 20, 25, 30]} tickFormatter={(t) => (t === 0 ? "Now" : `+${t}y`)} />
            <YAxis {...axis} width={64} tickFormatter={(v) => tkShort(v)} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(t, p) => `${t === 0 ? "Now" : `In ${t} years`} (${p?.[0]?.payload?.year ?? ""})`}
              formatter={(v, name, item) =>
                name === "band"
                  ? [`${tk(item.payload.low)}–${tk(item.payload.low + item.payload.band)}`, "Fair range"]
                  : [tk(Number(v)), name === "you" ? "You" : "Typical"]
              }
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }}
              formatter={(v) => ({ you: "You", market: "Typical for your job", band: "Fair range" })[v as string] ?? ""}
            />
            <Area dataKey="low" stackId="r" stroke="none" fill="transparent" legendType="none" isAnimationActive={false} />
            <Area dataKey="band" stackId="r" stroke="none" fill="var(--series-1)" fillOpacity={0.14} isAnimationActive={false} />
            <Line dataKey="market" stroke="var(--series-1)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="you" stroke="var(--series-gold)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="relative overflow-x-auto mt-5 -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-ink-2 border-b border-line">
              <th className="py-2 px-4 sm:px-0 font-medium">In</th>
              <th className="font-medium">Experience</th>
              <th className="text-right font-medium">Your pay (future taka)</th>
              <th className="text-right font-medium">In today&apos;s money</th>
              <th className="text-right font-medium">Typical then</th>
            </tr>
          </thead>
          <tbody>
            {f.horizons.map((p) => (
              <tr key={p.t} className={`border-b border-line ${p.pastCareer ? "text-muted" : ""}`}>
                <td className="py-2 px-4 sm:px-0">
                  <span className="num font-medium">{p.t} yrs</span> <span className="text-xs text-muted">({p.year})</span>
                </td>
                <td className="text-xs">
                  {p.experience.toFixed(0)} yrs · {p.levelLabel.split(" (")[0]}
                  {p.pastCareer && " · past a typical career"}
                </td>
                <td className="text-right num font-semibold">{tk(p.youNominal)}</td>
                <td className="text-right num">{tk(p.youReal)}</td>
                <td className="text-right num text-ink-2">{tk(nominal ? p.marketNominal : p.marketReal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-muted space-y-1.5 leading-relaxed">
        <p>
          <strong className="text-ink-2">How this works:</strong> you are {position} typical pay today, and the forecast keeps you there. Each year
          adds experience, valued on this employer type&apos;s own curve (which flattens after about 12 years), plus market pay growth
          ({GROWTH_LABEL[growth].toLowerCase()}). Inflation then turns that into future taka. In today&apos;s money that works out to about{" "}
          {pct(realCagr10, 1)} a year over the next 10 years.
        </p>
        <p>
          This is a projection, not a promise. It assumes you stay in the same kind of job and employer. Promotions, switching employer, or
          a new pay scale can change it a lot. Figures are monthly gross.
        </p>
      </div>
    </Card>
  );
}
