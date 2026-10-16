"use client";

import { useMemo, useState } from "react";
import { bench, functionsFor, group, jobFunction, LEVEL_CENTRE, levelForYears, peopleBelow, percentileOf, statsForYears, type CityId, type LevelId } from "@/lib/benchmark";
import { matchFunction, parseJobPost } from "@/lib/jobpost";
import { tk, pct } from "@/lib/format";
import { Card, ConfidenceBadge, controlClass, Field, Note, Select, Stat } from "@/components/ui";
import { FunctionSelect } from "@/components/EmployerJobPicker";
import { SalaryRange } from "@/components/SalaryRange";

const SAMPLE = `Management Trainee Officer (MTO)
The City Bank PLC
Salary: Tk 80,000 per month during training
Freshers are welcome to apply
Head Office, Gulshan, Dhaka`;

const SAMPLES = [
  { label: "Bank MTO", text: SAMPLE },
  { label: "bKash engineer", text: "Software Engineer (Backend) at bKash Limited\nExperience: 2 to 4 years\nSalary: 70k-100k\nLocation: Dhaka" },
  { label: "Unilever sales", text: "Territory Sales Officer\nUnilever Bangladesh Limited\nSalary: Negotiable\nMinimum 1 year experience in FMCG\nJob location: Rajshahi" },
  { label: "Accounts (Bangla)", text: "Accounts Officer\nবেতন: ২৫,০০০-৩০,০০০ টাকা\nঅভিজ্ঞতা: ন্যূনতম ২ বছর\nকর্মস্থল: চট্টগ্রাম" },
];

const FUNCTIONS = Object.entries(bench.functions).map(([id, f]) => ({ id, keywords: f.keywords }));

export function JobPostTool() {
  const [text, setText] = useState(SAMPLE);
  const [override, setOverride] = useState<{ fn?: string; level?: LevelId; group?: string; city?: CityId }>({});

  const parsed = useMemo(() => parseJobPost(text), [text]);
  const [autoFn] = useMemo(() => matchFunction(text, FUNCTIONS), [text]);
  const groupId = override.group ?? parsed.employer_group ?? "local_conglomerate";
  const available = functionsFor(groupId);
  const wanted = override.fn ?? autoFn ?? "officer";
  const fnId = available.includes(wanted) ? wanted : available[0];
  // Experience: the middle of the posted range ("2-4 years" -> 3), the minimum if open-ended, else 1 year.
  const postedYears =
    parsed.experience_min === null ? 1 : parsed.experience_max !== null ? (parsed.experience_min + parsed.experience_max) / 2 : parsed.experience_min;
  const years = override.level ? LEVEL_CENTRE[override.level] : postedYears;
  const level: LevelId = override.level ?? levelForYears(years);
  const city: CityId = override.city ?? ((parsed.city as CityId | null) ?? "dhaka");
  const stats = statsForYears(fnId, groupId, years, city);
  const mid = parsed.salary_min && parsed.salary_max ? (parsed.salary_min + parsed.salary_max) / 2 : null;
  const pctl = mid ? percentileOf(mid, stats) : null;
  const set = (patch: typeof override) => setOverride({ ...override, ...patch });

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card eyebrow="Paste" title="The job post">
        <Field label="Job post text" hint="English, Bangla or mixed. It's read in your browser only.">
          {(id) => (
            <textarea
              id={id}
              rows={10}
              className={`${controlClass} num !text-sm`}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setOverride({});
              }}
            />
          )}
        </Field>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {SAMPLES.map((s) => (
            <button key={s.label} className="rounded-md border border-line px-2 py-0.5 hover:bg-surface-2" onClick={() => { setText(s.text); setOverride({}); }}>
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 min-w-0">
        <Card eyebrow="We read" title="What the post says" aside={<ConfidenceBadge level={stats.confidence} />}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm mb-5">
            <dt className="text-muted">Salary</dt>
            <dd className="num">
              {parsed.salary_min
                ? parsed.salary_min === parsed.salary_max
                  ? tk(parsed.salary_min)
                  : `${tk(parsed.salary_min)} – ${tk(parsed.salary_max!)}`
                : parsed.negotiable
                  ? "Negotiable"
                  : "Not stated"}
              {parsed.salary_period === "yearly" && <span className="text-muted font-sans"> (converted from yearly)</span>}
            </dd>
            <dt className="text-muted">Experience</dt>
            <dd>{parsed.experience_min === null ? "Not stated" : `${parsed.experience_min}${parsed.experience_max ? `–${parsed.experience_max}` : "+"} years`}</dd>
            <dt className="text-muted">Employer</dt>
            <dd>{parsed.employer_group ? group(parsed.employer_group).label : "Not recognised (choose below)"}</dd>
          </dl>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select<string> label="Employer type" value={groupId} onChange={(v) => set({ group: v })} options={bench.groups.map((g) => ({ value: g.id, label: g.label }))} />
            <FunctionSelect groupId={groupId} value={fnId} onChange={(v) => set({ fn: v })} />
            <Select<LevelId> label="Level" value={level} onChange={(v) => set({ level: v })} options={bench.levels.map((l) => ({ value: l.id, label: l.label }))} />
            <Select<CityId> label="Location" value={city} onChange={(v) => set({ city: v })} options={bench.cities.map((c) => ({ value: c.id, label: c.label }))} />
          </div>
        </Card>

        <Card eyebrow="Verdict" title={mid ? "Is the pay fair?" : "What to ask for"}>
          {mid && pctl !== null ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <Stat label="Offer" value={tk(mid)} sub="mid-point" />
                <Stat label="Typical" value={tk(stats.p50)} sub={`${jobFunction(fnId).short}`} />
                <Stat label="Pays more than" value={`${peopleBelow(pctl)}%`} sub="of similar jobs" tone={pctl < 25 ? "bad" : pctl > 60 ? "good" : "gold"} />
              </div>
              <SalaryRange stats={stats} you={mid} youLabel="Offer" />
              <div className="mt-4">
                <Note tone={pctl < 25 ? "warn" : "info"}>
                  {pctl < 25
                    ? `Low for this job. Ask for about ${tk(stats.p50)} (${pct(stats.p50 / mid - 1)} more), or check whether bonuses and provident fund make up the difference.`
                    : pctl < 50
                      ? `Fair, but below typical. Negotiate towards ${parsed.salary_max && parsed.salary_max > mid ? `the top of the band (${tk(parsed.salary_max)}) or ` : ""}${tk(stats.p50)}.`
                      : "A competitive offer. Compare the benefits and growth before you decide, using Compare offers."}
                </Note>
              </div>
            </>
          ) : (
            <>
              <p className="text-ink-2 mb-4">
                No salary is stated. For this job, a reasonable ask is <strong className="num text-ink">{tk(stats.p50)}–{tk(stats.p75)}</strong>.
              </p>
              <SalaryRange stats={stats} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
