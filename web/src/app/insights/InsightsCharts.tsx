"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import insights from "@/data/insights.json";
import { pct, signedPct, tk, tkK } from "@/lib/format";
import { Card, Segmented } from "@/components/ui";

const axis = { stroke: "var(--axis)", tick: { fill: "var(--muted)", fontSize: 12, fontFamily: "var(--font-plex-mono)" }, tickLine: false };
const grid = { stroke: "var(--grid)", vertical: false };
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", fontSize: 13 },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--ink-2)" },
  cursor: { fill: "var(--surface-2)" },
};

function ChartOrTable({ eyebrow, title, sub, chart, table }: { eyebrow: string; title: string; sub?: string; chart: React.ReactNode; table: React.ReactNode }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card
      eyebrow={eyebrow}
      title={title}
      aside={
        <Segmented
          label={`${title} view`}
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      }
    >
      {sub && <p className="text-sm text-ink-2 -mt-2 mb-4 max-w-3xl">{sub}</p>}
      {view === "chart" ? chart : <div className="relative overflow-x-auto">{table}</div>}
    </Card>
  );
}

const th = "py-1.5 text-left font-medium text-ink-2 border-b border-line";
const td = "py-1.5 border-b border-line";

export function EmployerChart() {
  const rows = [
    ...insights.market.entry_by_group
      .filter((r) => r.group !== "un_agency")
      .map((r) => ({ label: r.label, value: r.entry_p50, lo: r.entry_p25, hi: r.entry_p75, kind: "private", note: `${r.function_short}. e.g. ${r.examples.join(", ")}`, confidence: r.confidence })),
    ...insights.govt_entry.map((g) => ({ label: `Government Grade ${g.grade}`, value: g.monthly, lo: g.monthly, hi: g.monthly, kind: "govt", note: g.note, confidence: "high" })),
  ].sort((a, b) => b.value - a.value);
  return (
    <ChartOrTable
      eyebrow="01 · Where to start"
      title="What fresh graduates earn, by employer"
      sub="Typical monthly pay for a fresher in Dhaka on a trainee or officer track (software engineer at software firms). Government figures are the full 2026 scale with bonuses spread over the year."
      chart={
        <div style={{ height: rows.length * 34 + 30 }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" horizontal={false} />
              <XAxis type="number" {...axis} tickFormatter={(v) => tkK(v)} />
              <YAxis type="category" dataKey="label" width={210} {...axis} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, _n, item) => [`${tk(Number(v))}${item.payload.kind === "private" ? ` (fair range ${tkK(item.payload.lo)}–${tkK(item.payload.hi)})` : ""}`, "Typical"]}
                labelFormatter={(l, p) => `${l}${p?.[0]?.payload?.note ? `: ${p[0].payload.note}` : ""}`}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {rows.map((r) => (
                  <Cell key={r.label} fill={r.kind === "govt" ? "var(--series-3)" : "var(--series-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-ink-2 flex gap-4 mt-2">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: "var(--series-1)" }} />Private / NGO</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: "var(--series-3)" }} />Government</span>
          </p>
        </div>
      }
      table={
        <table className="w-full text-sm min-w-[520px]">
          <thead><tr><th className={th}>Employer</th><th className={th}>Examples / note</th><th className={`${th} text-right`}>Typical</th><th className={`${th} text-right`}>Fair range</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label}><td className={td}>{r.label}</td><td className={`${td} text-xs text-muted`}>{r.note}</td><td className={`${td} text-right num`}>{tk(r.value)}</td><td className={`${td} text-right num`}>{r.kind === "private" ? `${tkK(r.lo)}–${tkK(r.hi)}` : "fixed"}</td></tr>)}</tbody>
        </table>
      }
    />
  );
}

export function FunctionChart() {
  const data = [...insights.market.functions].sort((a, b) => b.mid_p50 - a.mid_p50);
  return (
    <ChartOrTable
      eyebrow="02 · By job"
      title="What mid-level jobs pay"
      sub="Typical monthly pay after 3-6 years at a large local company (NGO jobs: at an NGO). The table also shows the best-paying employer type for each job."
      chart={
        <div style={{ height: data.length * 30 + 30 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" horizontal={false} />
              <XAxis type="number" {...axis} tickFormatter={(v) => tkK(v)} />
              <YAxis type="category" dataKey="short" width={150} {...axis} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, _n, item) => [`${tk(Number(v))} (fair range ${tkK(item.payload.mid_p25)}–${tkK(item.payload.mid_p75)})`, "Typical"]}
                labelFormatter={(_l, p) => (p?.[0]?.payload ? `${p[0].payload.title}: best paid at ${p[0].payload.best_group_label} (${tk(p[0].payload.best_mid_p50)})` : "")}
              />
              <Bar dataKey="mid_p50" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full text-sm min-w-[620px]">
          <thead><tr><th className={th}>Job</th><th className={`${th} text-right`}>Fresher</th><th className={`${th} text-right`}>Mid-level</th><th className={`${th} text-right`}>Senior</th><th className={th}>&nbsp;Best-paying employer (mid)</th></tr></thead>
          <tbody>{data.map((r) => <tr key={r.function}><td className={td}>{r.title}</td><td className={`${td} text-right num`}>{tk(r.entry_p50)}</td><td className={`${td} text-right num`}>{tk(r.mid_p50)}</td><td className={`${td} text-right num`}>{tk(r.senior_p50)}</td><td className={`${td} text-xs`}>&nbsp;{r.best_group_label} · <span className="num">{tk(r.best_mid_p50)}</span></td></tr>)}</tbody>
        </table>
      }
    />
  );
}

export function PayScaleChart() {
  const data = insights.payscale.grades.map((g) => ({ grade: `${g.grade}`, real: g.real_change, nominal: g.nominal_increase, s15: g.start_2015, s26: g.start_2026 }));
  return (
    <ChartOrTable
      eyebrow="03 · Government"
      title="The 2026 pay scale after inflation"
      sub={`Real change in starting basic since 2015. Prices rose ${pct(insights.inflation.factor_jul2015_to_jun2026 - 1)}, so the 100% raise for grades 1-11 still leaves them slightly behind.`}
      chart={
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="grade" {...axis} label={{ value: "Grade (1 = highest)", position: "insideBottom", offset: -4, fill: "var(--muted)", fontSize: 12 }} />
              <YAxis {...axis} ticks={[-0.05, 0, 0.05, 0.1, 0.15]} domain={[-0.07, 0.17]} tickFormatter={(v) => pct(v)} />
              <ReferenceLine y={0} stroke="var(--axis)" />
              <Tooltip {...tooltipStyle} formatter={(v, _n, item) => [`${signedPct(Number(v), 1)} real (nominal +${pct(item.payload.nominal)})`, "Change"]} labelFormatter={(l) => `Grade ${l}`} />
              <Bar dataKey="real" radius={[4, 4, 4, 4]} maxBarSize={22}>
                {data.map((d) => (
                  <Cell key={d.grade} fill={d.real >= 0 ? "var(--series-1)" : "var(--diverge-neg)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Grade</th><th className={`${th} text-right`}>2015</th><th className={`${th} text-right`}>2026</th><th className={`${th} text-right`}>Real change</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.grade}><td className={td}>{d.grade}</td><td className={`${td} text-right num`}>{tk(d.s15)}</td><td className={`${td} text-right num`}>{tk(d.s26)}</td><td className={`${td} text-right num`}>{signedPct(d.real, 1)}</td></tr>)}</tbody>
        </table>
      }
    />
  );
}

export function TaxChart() {
  const data = insights.tax.curve.map((c) => ({ m: c.monthly_gross, plain: c.effective_rate, invested: c.annual_tax_with_max_rebate / (c.monthly_gross * 12), tax: c.annual_tax, taxInv: c.annual_tax_with_max_rebate, inv: c.investment_for_max_rebate }));
  return (
    <ChartOrTable
      eyebrow="04 · Tax"
      title="How much of your salary goes to income tax"
      sub={`No tax up to ${tk(insights.tax.tax_free_monthly_salary.general)} a month (${tk(insights.tax.tax_free_monthly_salary.woman_or_senior)} for women and people 65+). Tax-saving investment lowers the rate at every level.`}
      chart={
        <div className="h-60">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="m" type="number" domain={[20000, 500000]} ticks={[50000, 100000, 200000, 300000, 400000, 500000]} {...axis} tickFormatter={(v) => tkK(v)} />
              <YAxis {...axis} ticks={[0, 0.05, 0.1, 0.15, 0.2]} domain={[0, 0.22]} tickFormatter={(v) => pct(v)} />
              <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--axis)" }} labelFormatter={(l) => `${tk(Number(l))} a month`} formatter={(v, name) => [pct(Number(v), 1), name === "plain" ? "No investment" : "With full rebate"]} />
              <Legend formatter={(v) => (v === "plain" ? "No tax-saving investment" : "With investment for the full rebate")} wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
              <Line dataKey="plain" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line dataKey="invested" stroke="var(--series-gold)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Monthly gross</th><th className={`${th} text-right`}>Tax / year</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Invest</th><th className={`${th} text-right`}>Tax after rebate</th></tr></thead>
          <tbody>{data.filter((_, i) => i % 2 === 0).map((d) => <tr key={d.m}><td className={`${td} num`}>{tk(d.m)}</td><td className={`${td} text-right num`}>{tk(d.tax)}</td><td className={`${td} text-right num`}>{pct(d.plain, 1)}</td><td className={`${td} text-right num`}>{tk(d.inv)}</td><td className={`${td} text-right num`}>{tk(d.taxInv)}</td></tr>)}</tbody>
        </table>
      }
    />
  );
}
