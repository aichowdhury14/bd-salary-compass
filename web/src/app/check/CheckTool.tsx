"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { bench, effectiveYears, functionsFor, group, jobFunction, levelForYears, levelLabel, peopleBelow, type CityId } from "@/lib/benchmark";
import { assess, type RecKind } from "@/lib/recommend";
import { publishedFigures, SOURCE_LABEL } from "@/lib/companies";
import { govtPackage, payScale } from "@/lib/govtpay";
import { tk, tkK, pct } from "@/lib/format";
import { Card, ConfidenceBadge, Field, Note, NumberInput, Segmented, Select, Stat } from "@/components/ui";
import { EmployerSelect, FunctionSelect, GOVT, parseEmployer } from "@/components/EmployerJobPicker";
import { SalaryRange } from "@/components/SalaryRange";
import { useCoach, useShareSalary } from "@/components/coach/CoachProvider";
import { ForecastCard } from "@/components/ForecastCard";
import { NegotiationScript } from "@/components/NegotiationScript";
import { HundredDots, RaiseCheckCard, TakeHomeLine, WhatIfCard } from "@/components/PayInsights";

// The AI coach itself floats on every page (see app/layout.tsx); this page shares its results with it.
const AI_COACH_ENABLED = process.env.NEXT_PUBLIC_AI_COACH === "on";

const KIND_LABEL: Record<RecKind, string> = {
  negotiate: "Negotiate",
  promotion: "Grow",
  employer: "Switch employer",
  role: "Switch job",
  tax: "Save tax",
  inflation: "Inflation check",
};

const VERDICT_TONE = { below: "text-bad", within: "text-gold", above: "text-good" } as const;

export function CheckTool() {
  const [employer, setEmployer] = useState("large_bank|The City Bank");
  const [functionId, setFunctionId] = useState("officer");
  const [totalYears, setTotalYears] = useState(2);
  const [yearsHere, setYearsHere] = useState(2);
  const [earlierSameJob, setEarlierSameJob] = useState(true);
  const [salary, setSalary] = useState(85000);
  const [city, setCity] = useState<CityId>("dhaka");
  const [showAll, setShowAll] = useState(false);

  const { groupId, company } = parseEmployer(employer);
  const isGovt = groupId === GOVT;
  const fnIds = isGovt ? [] : functionsFor(groupId);
  const fnId = fnIds.includes(functionId) ? functionId : fnIds[0];
  const exp = effectiveYears({ totalYears, yearsHere, earlierSameJob });
  const years = exp.years;
  const level = levelForYears(years);
  const employerKind = isGovt ? "" : group(groupId).label;

  const a = useMemo(
    () => (!isGovt && fnId && salary > 0 ? assess({ functionId: fnId, groupId, company, years, level, city, monthlyGross: Math.min(salary, 10_000_000) }) : null),
    [isGovt, fnId, groupId, company, years, level, city, salary],
  );
  const setTotal = (v: number) => {
    const t = Math.max(0, Math.min(40, v));
    // Keep "years here" in step when someone has only ever worked at this kind of employer.
    if (yearsHere === totalYears || yearsHere > t) setYearsHere(t);
    setTotalYears(t);
  };
  const figures = !isGovt && fnId ? publishedFigures(groupId, fnId, company) : [];
  const where = company ?? (isGovt ? "government" : group(groupId).label);

  // Let the AI coach (floating on every page) give advice about these results.
  const { setOpen: openCoach } = useCoach();
  useShareSalary(
    a && fnId
      ? {
          profile: { role: `${jobFunction(fnId).title} at ${where}`, level: levelLabel(level), employer: group(groupId).label, city: bench.cities.find((c) => c.id === city)!.label, years, monthlyGross: salary, skills: jobFunction(fnId).skills },
          assessment: a,
        }
      : null,
    `${fnId}|${groupId}|${company}|${city}|${years}|${salary}`,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
      <Card eyebrow="Your details" title="Your job">
        <div className="grid gap-4">
          <EmployerSelect value={employer} onChange={setEmployer} />
          {!isGovt && fnId && <FunctionSelect groupId={groupId} value={fnId} onChange={setFunctionId} />}
          {!isGovt && (
            <>
              <Field label={`Total work experience: ${totalYears} year${totalYears === 1 ? "" : "s"}`}>
                {(id) => (
                  <input id={id} type="range" min={0} max={30} step={0.5} value={totalYears} onChange={(e) => setTotal(Number(e.target.value))} className="w-full" />
                )}
              </Field>
              {totalYears > 0 && (
                <Field label={`Of which at this kind of employer: ${yearsHere} yr${yearsHere === 1 ? "" : "s"}`} hint={`Years at any ${employerKind.toLowerCase()} (any bank, if you work at a bank)`}>
                  {(id) => (
                    <input id={id} type="range" min={0} max={totalYears} step={0.5} value={Math.min(yearsHere, totalYears)} onChange={(e) => setYearsHere(Number(e.target.value))} className="w-full" />
                  )}
                </Field>
              )}
              {exp.other > 0 && (
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">
                    The other {exp.other} yr{exp.other === 1 ? "" : "s"} elsewhere were in
                  </span>
                  <Segmented<"same" | "diff">
                    label="Earlier job type"
                    value={earlierSameJob ? "same" : "diff"}
                    onChange={(v) => setEarlierSameJob(v === "same")}
                    options={[
                      { value: "same", label: "a similar job" },
                      { value: "diff", label: "a different job" },
                    ]}
                  />
                </div>
              )}
              <p className="text-xs text-muted -mt-1">
                Experience that counts here: <strong className="num text-ink">{years.toFixed(1)} yrs</strong> · {levelLabel(level)}
              </p>
              <NumberInput label="Monthly salary (gross)" value={salary} onChange={setSalary} prefix="৳" step={1000} hint="Before tax and provident fund, without festival bonus" />
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-2">More options</summary>
                <div className="mt-3">
                  <Select<CityId> label="Work location" value={city} onChange={setCity} options={bench.cities.map((c) => ({ value: c.id, label: c.label }))} />
                </div>
              </details>
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-6 min-w-0">
        {isGovt ? (
          <GovtQuick />
        ) : a && fnId ? (
          <>
            <section className="rounded-xl border border-line bg-surface overflow-hidden">
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="eyebrow">Salary check · {where}</p>
                  <ConfidenceBadge level={a.stats.confidence} />
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight">
                  You&apos;re paid <span className={VERDICT_TONE[a.verdict.id]}>{a.verdict.headline}</span>.
                </h2>
                <p className="text-ink-2 mt-2 max-w-xl">
                  Out of 100 people working as a {jobFunction(fnId).short.toLowerCase()} with similar experience at this kind of employer,{" "}
                  <strong className="text-ink num">{peopleBelow(a.percentile)}</strong> earn less than you.
                </p>
                <div className="mt-6">
                  <SalaryRange stats={a.stats} you={salary} />
                </div>
                <div className="mt-5">
                  <p className="eyebrow mb-2.5">100 people like you</p>
                  <HundredDots percentile={a.percentile} />
                </div>
              </div>
              <div className="tear" />
              <div className="p-5 sm:p-7 grid grid-cols-2 sm:grid-cols-3 gap-5 bg-[color-mix(in_srgb,var(--surface-2)_45%,transparent)]">
                <Stat label="Typical pay" value={tk(a.stats.p50)} sub="the middle (median)" />
                <Stat label="Fair range" value={`${tkK(a.stats.p25)}–${tkK(a.stats.p75)}`} sub="the middle half of people" />
                <Stat
                  label={a.gapToMedian > 0 ? "Below typical by" : "Above typical by"}
                  value={tk(Math.abs(a.gapToMedian))}
                  sub={`${pct(Math.abs(a.gapToMedian) / salary)} of your pay`}
                  tone={a.gapToMedian > 0 ? "bad" : "good"}
                />
                <div className="col-span-2 sm:col-span-3">
                  <TakeHomeLine monthlyGross={salary} />
                </div>
              </div>
              {a.stats.confidence !== "high" && (
                <div className="px-5 sm:px-7 pb-5">
                  <Note tone="warn">
                    {a.stats.confidence === "low"
                      ? "There is no published figure for this job at this kind of employer, so the estimate borrows the employer's general pay level. Treat it as a rough guide."
                      : "Published figures exist for this employer and job, but not at your experience level, so the range is wider than usual."}{" "}
                    <Link className="underline" href="/methodology">See sources</Link>
                  </Note>
                </div>
              )}
            </section>

            <WhatIfCard functionId={fnId} groupId={groupId} years={years} city={city} jobLabel={jobFunction(fnId).short} />

            <RaiseCheckCard monthlyGross={salary} />

            <Card eyebrow="Transparent" title="How we calculated this">
              <ol className="text-sm grid gap-2.5">
                <li className="flex justify-between gap-4">
                  <span className="text-ink-2">
                    <span className="num text-gold mr-2">1</span>Typical fresher pay for {jobFunction(fnId).short.toLowerCase()} at {group(groupId).label}, Dhaka
                    <span className="block text-xs text-muted ml-5">Fitted to the published figures for this job and employer type</span>
                  </span>
                  <span className="num font-medium whitespace-nowrap">{tk(a.stats.breakdown.freshMedian)}</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-ink-2">
                    <span className="num text-gold mr-2">2</span>Experience that counts: {years.toFixed(1)} yrs
                    <span className="block text-xs text-muted ml-5">
                      {exp.other > 0
                        ? `${exp.here} yrs here + ${exp.other} yrs elsewhere × ${Math.round(exp.credit * 100)}% (${earlierSameJob ? "similar job" : "different job"}). `
                        : "All your experience is at this kind of employer. "}
                      Pay growth follows this employer type&apos;s own curve.
                    </span>
                  </span>
                  <span className="num font-medium whitespace-nowrap">× {a.stats.breakdown.experienceMultiplier.toFixed(2)}</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-ink-2">
                    <span className="num text-gold mr-2">3</span>Location: {bench.cities.find((c) => c.id === city)!.label}
                    {city !== "dhaka" && <span className="block text-xs text-muted ml-5">Assumed adjustment; most published figures are for Dhaka</span>}
                  </span>
                  <span className="num font-medium whitespace-nowrap">× {a.stats.breakdown.cityMultiplier.toFixed(2)}</span>
                </li>
                <li className="flex justify-between gap-4 border-t border-line pt-2.5 font-medium">
                  <span>
                    <span className="num text-gold mr-2">=</span>Typical pay (median)
                  </span>
                  <span className="num whitespace-nowrap">{tk(a.stats.p50)}</span>
                </li>
                <li className="text-xs text-muted">
                  The fair range ({tkK(a.stats.p25)}–{tkK(a.stats.p75)}) covers the middle half of people, and it is wider when fewer figures back the estimate. All figures are
                  monthly gross: before tax and provident fund, without festival bonus.
                </li>
              </ol>
            </Card>

            <ForecastCard input={{ functionId: fnId, groupId, city, years, totalYears, monthlyGross: salary }} />

            {figures.length > 0 && (
              <Card eyebrow="Real numbers" title={company ? `What ${company} and similar employers have published` : `Published figures: ${group(groupId).label}`}>
                <ul className="divide-y divide-line">
                  {figures.slice(0, 6).map(({ company: c, figure: f }, i) => (
                    <li key={i} className="py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0">
                        <p className={`font-medium ${c === company ? "text-gold" : ""}`}>{c}</p>
                        <p className="text-xs text-muted">
                          {f.note} ·{" "}
                          {f.source_url ? (
                            <a className="underline" href={f.source_url} target="_blank" rel="noopener noreferrer">
                              {SOURCE_LABEL[f.source_type] ?? f.source_type}
                            </a>
                          ) : (
                            SOURCE_LABEL[f.source_type]
                          )}
                          {f.published && `, ${f.published}`}
                        </p>
                      </div>
                      <p className="num font-semibold">{f.low === f.high ? tk(f.median) : `${tk(f.low)}–${Math.round(f.high / 1000)}k`}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card eyebrow="What to do next" title="Your best moves, biggest first">
              <ol className="grid gap-3">
                {a.recommendations.slice(0, showAll ? undefined : 3).map((r, i) => (
                  <li key={i} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="eyebrow !text-[0.65rem] rounded bg-surface-2 px-1.5 py-0.5">{KIND_LABEL[r.kind]}</span>
                      {r.monthlyImpact > 0 && <span className="num text-xs font-semibold text-good">+{tk(r.monthlyImpact)}/mo</span>}
                    </div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-sm text-ink-2 mt-1 leading-relaxed">{r.detail}</p>
                    {r.bullets && (
                      <ul className="mt-2 text-sm text-ink-2 grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
                        {r.bullets.map((b) => (
                          <li key={b} className="before:content-['→_'] before:text-gold">
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {a.recommendations.length > 3 && (
                <button className="mt-3 text-sm underline text-ink-2" onClick={() => setShowAll(!showAll)}>
                  {showAll ? "Show fewer" : `Show all ${a.recommendations.length}`}
                </button>
              )}
            </Card>

            <Card eyebrow="Ready to send" title="Your negotiation script">
              <NegotiationScript functionId={fnId} groupId={groupId} years={years} monthlyGross={salary} assessment={a} />
            </Card>

            {AI_COACH_ENABLED && (
              <Card eyebrow="Free · AI · English or বাংলা">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-ink-2 text-sm max-w-md">
                    Questions about these results? The AI coach has read them and can write a raise script, plan a job switch, or answer
                    follow-ups.
                  </p>
                  <button type="button" onClick={() => openCoach(true)} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:opacity-90">
                    Ask the AI coach
                  </button>
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <p className="text-ink-2">Enter your monthly salary to see where you stand.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function GovtQuick() {
  const [grade, setGrade] = useState(9);
  const full = govtPackage({ grade, step: 0, phase: "full", location: "dhaka", over50: false, children: 0 });
  const now = govtPackage({ grade, step: 0, phase: "p1", location: "dhaka", over50: false, children: 0 });
  return (
    <Card eyebrow="Government job" title="Government pay is set by grade, not by the market">
      <div className="grid sm:grid-cols-[220px_1fr] gap-5 items-start">
        <Select<string>
          label="Your grade"
          value={String(grade)}
          onChange={(v) => setGrade(Number(v))}
          options={payScale.grades.map((g) => ({ value: String(g.grade), label: `Grade ${g.grade}` }))}
        />
        <div className="grid grid-cols-2 gap-5">
          <Stat label="Starting basic now" value={tk(now.basic)} sub="Jul–Dec 2026 phase" />
          <Stat label="Full 2026 scale" value={tk(full.monthlyGross)} sub="monthly gross in Dhaka, from 2027–28" tone="gold" />
        </div>
      </div>
      <p className="text-sm text-ink-2 mt-4">
        Steps, phases, house rent by duty station, and the yearly total are all in the{" "}
        <Link className="underline" href="/govt">
          government pay calculator
        </Link>
        .
      </p>
    </Card>
  );
}
