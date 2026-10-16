"use client";

import { useMemo, useState } from "react";
import insights from "@/data/insights.json";
import { basicSteps, GOVT_LOCATIONS, govtPackage, payScale, type GovtLocation, type PhaseId } from "@/lib/govtpay";
import { tk, pct, signedPct } from "@/lib/format";
import { Card, Checkbox, Note, NumberInput, Segmented, Select, Stat } from "@/components/ui";

export function GovtTool() {
  const [grade, setGrade] = useState(9);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<PhaseId>("full");
  const [location, setLocation] = useState<GovtLocation>("dhaka");
  const [over50, setOver50] = useState(false);
  const [children, setChildren] = useState(0);

  const steps = useMemo(() => basicSteps(grade), [grade]);
  const safeStep = Math.min(step, steps.length - 1);
  const pkg = useMemo(() => govtPackage({ grade, step: safeStep, phase, location, over50, children }), [grade, safeStep, phase, location, over50, children]);
  const realRow = insights.payscale.grades.find((g) => g.grade === grade)!;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] items-start">
      <Card title="Your post" className="lg:sticky lg:top-28">
        <div className="grid gap-4">
          <Select<string>
            label="Grade"
            value={String(grade)}
            onChange={(v) => {
              setGrade(Number(v));
              setStep(0);
            }}
            options={payScale.grades.map((g) => ({ value: String(g.grade), label: `Grade ${g.grade} (starts ${tk(g.start_2026)})` }))}
          />
          <NumberInput
            label="Increments received"
            value={safeStep}
            onChange={setStep}
            max={steps.length - 1}
            hint={`0 = starting basic. This grade has ${steps.length - 1} steps (estimated at 5% each).`}
          />
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Implementation phase</span>
            <Segmented<PhaseId>
              label="Phase"
              value={phase}
              onChange={setPhase}
              options={payScale.phases.map((p) => ({ value: p.id as PhaseId, label: p.label }))}
            />
          </div>
          <Select<GovtLocation> label="Duty station" value={location} onChange={setLocation} options={GOVT_LOCATIONS.map((l) => ({ value: l.id, label: l.label }))} />
          <NumberInput label="Children in school" value={children} onChange={setChildren} max={5} />
          <Checkbox label="Aged over 50" checked={over50} onChange={setOver50} />
        </div>
      </Card>

      <div className="grid gap-5 min-w-0">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Basic" value={tk(pkg.basic)} sub={`2015 scale: ${tk(pkg.basic2015)}`} />
            <Stat label="Monthly gross" value={tk(pkg.monthlyGross)} sub="basic + allowances" />
            <Stat label="Yearly total" value={tk(pkg.annualTotal)} sub="incl. festival & Boishakhi" />
            <Stat label="Real change vs 2015" value={signedPct(realRow.real_change, 1)} sub="starting basic, after inflation" tone={realRow.real_change < 0 ? "bad" : "good"} />
          </div>
        </Card>

        <Card title="Breakdown">
          <table className="w-full text-sm tabular">
            <tbody className="[&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-line">
              <tr><td>Basic pay ({payScale.phases.find((p) => p.id === phase)!.label})</td><td className="text-right">{tk(pkg.basic)}</td></tr>
              <tr><td className="text-ink-2">House rent</td><td className="text-right text-ink-2">{tk(pkg.houseRent)}</td></tr>
              <tr><td className="text-ink-2">Medical allowance</td><td className="text-right text-ink-2">{tk(pkg.medical)}</td></tr>
              {pkg.education > 0 && <tr><td className="text-ink-2">Education assistance</td><td className="text-right text-ink-2">{tk(pkg.education)}</td></tr>}
              <tr className="font-medium"><td>Monthly gross</td><td className="text-right">{tk(pkg.monthlyGross)}</td></tr>
              <tr><td className="text-ink-2">Festival bonuses (2 × basic, yearly)</td><td className="text-right text-ink-2">{tk(pkg.festivalAnnual)}</td></tr>
              <tr><td className="text-ink-2">Bangla New Year allowance ({pct(payScale.boishakhi_rate)} of basic)</td><td className="text-right text-ink-2">{tk(pkg.boishakhiAnnual)}</td></tr>
              <tr className="font-semibold"><td>Yearly total</td><td className="text-right">{tk(pkg.annualTotal)}</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-muted mt-3">{payScale.phase_note} {payScale.house_rent.note} {payScale.increment_note}</p>
        </Card>

        <Card title="Typical entry grades">
          <ul className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {payScale.common_entry_grades.map((p) => (
              <li key={p.post} className="flex justify-between gap-3 border-b border-line py-1">
                <span>{p.post}</span>
                <button className="text-gold underline shrink-0" onClick={() => { setGrade(p.grade); setStep(0); }}>
                  Grade {p.grade}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted mt-2">{payScale.common_entry_grades_note}</p>
        </Card>

        <Note>
          Prices rose {pct(insights.inflation.factor_jul2015_to_jun2026 - 1)} between July 2015 and June 2026. Grades 1-11 got a
          100% raise, which still leaves their starting basic about 5% short of 2015 buying power. Grades 12-20 got 115-142% and come out
          ahead. Source: {payScale.gazette}.
        </Note>
      </div>
    </div>
  );
}
