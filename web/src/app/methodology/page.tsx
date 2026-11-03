import type { Metadata } from "next";
import anchors from "@/data/anchors.json";
import insights from "@/data/insights.json";
import taxRules from "@/data/tax_rules.json";
import payScale from "@/data/pay_scale_2026.json";
import cpi from "@/data/cpi.json";
import { bench } from "@/lib/benchmark";
import { tk } from "@/lib/format";
import { Card, PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Data & methodology",
  description: "Sources, model and privacy approach behind BD Salary Compass.",
};

function Src({ name, url }: { name: string; url?: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-words">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

export default function Page() {
  const v = insights.validation;
  return (
    <>
      <PageTitle eyebrow="Method" title="Data & methodology" bn="তথ্যসূত্র ও পদ্ধতি">
        How the numbers are built, where they come from, and what they can&apos;t tell you.
      </PageTitle>

      <div className="grid gap-5">
        <Card eyebrow="Privacy" title="Your data">
          <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1.5">
            <li>There is no database and no account. Every calculator runs in your browser, and nothing you type is saved or logged.</li>
            <li>No paid or third-party AI service is used. The negotiation script and the forecast are built in your browser from your own numbers.</li>
          </ul>
        </Card>

        <Card eyebrow="Model" title="How salaries are estimated">
          <div className="text-sm text-ink-2 space-y-2 leading-relaxed">
            <p>
              Bangladesh has no open, crawlable salary dataset, and Bdjobs.com&apos;s robots.txt disallows crawlers. The model is therefore fitted to{" "}
              <strong className="text-ink">{anchors.length} published salary figures</strong> (listed below), not to bulk job posts.
            </p>
            <p>
              Each estimate combines three things: <strong className="text-ink">the job</strong> (finance, software, sales...), <strong className="text-ink">the kind of employer</strong>{" "}
              (multinational FMCG, large private bank, top software company...), and <strong className="text-ink">years of experience</strong>. Technically:{" "}
              <code className="text-ink">ln(salary) = job + employer + experience + city + noise</code>, fitted by weighted ridge regression with priors.
              Job circulars and official figures carry the most weight, and single blog estimates the least.
            </p>
            <p>
              Employer pay levels (× a large local company): {bench.groups.map((g) => `${g.label} ${g.multiplier}×`).join("; ")}.
            </p>
            <p>
              <strong className="text-ink">Experience.</strong> Each employer type has its own pay-growth curve, fitted to figures at different career stages.
              Bank officer ladders, for example, rise much more slowly than multinational fast tracks: Senior Principal Officers (usually 6-9 years) report a median
              of about Tk 70,000 across banks. The growth per experience level relative to the shared curve is:{" "}
              {bench.groups.filter((g) => g.experience_slope !== 1).map((g) => `${g.label} ${g.experience_slope}×`).join("; ")}. Estimates are interpolated
              smoothly between levels, so 2.9 and 3.1 years don&apos;t jump, and pay never falls with experience (at least +4% per level).
            </p>
            <p>
              <strong className="text-ink">Changing employer type.</strong> If you moved, say from a local company to a bank, years at the same kind of employer count in
              full. Years elsewhere count {Math.round(bench.experience_credit.same_job_other_employer * 100)}% if you did a similar job, and{" "}
              {Math.round(bench.experience_credit.different_job * 100)}% if it was a different job. This is an assumption: employers in Bangladesh, especially banks, often
              give only partial credit for outside experience. The salary check shows the experience it used.
            </p>
            <p>
              Shared experience curve: {Object.entries(bench.level_multipliers).map(([k, x]) => `${k} ${x}×`).join(", ")}. City adjustments are assumptions:{" "}
              {bench.cities.map((c) => `${c.label} ${c.multiplier}×`).join(", ")}.
            </p>
            <p>
              Each job-and-employer combination carries a confidence label. <em>Well sourced</em> means two or more figures for that exact combination;{" "}
              <em>rough estimate</em> means the combination borrows the employer&apos;s general pay level, so its range is shown wider.
            </p>
            <p>
              Test: in a leave-one-out test, each figure is predicted from all the others. The median error is <strong className="text-ink">{v.median_abs_pct_error}%</strong>{" "}
              (mean {v.mean_abs_pct_error}%), against {v.baseline_median_abs_pct_error}% for the prior assumptions alone. Job circulars are reproduced within about {v.by_source_type.job_circular}%.
            </p>
          </div>
        </Card>

        <Card eyebrow="Data" title={`Salary figures used (${anchors.length})`}>
          <div className="relative overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-ink-2 border-b border-line">
                  <th className="py-2 px-4 sm:px-0 font-medium">Job · employer</th>
                  <th className="font-medium">Figure</th>
                  <th className="text-right font-medium">Model</th>
                  <th className="font-medium">&nbsp;Type</th>
                  <th className="font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {anchors.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="py-1.5 px-4 sm:px-0">
                      {bench.functions[a.function]?.short ?? a.function}
                      <span className="block text-xs text-muted">
                        {Object.keys(a.group).map((g) => bench.groups.find((x) => x.id === g)?.label ?? g).join(" / ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap num">
                      {a.low === a.high ? tk(a.low) : `${tk(a.low)}–${tk(a.high)}`}
                      <span className="block text-xs text-muted font-sans whitespace-normal">{a.note}</span>
                    </td>
                    <td className="text-right whitespace-nowrap num">{tk(a.model_median)}</td>
                    <td className="text-xs">&nbsp;{a.source_type.replace("_", " ")}</td>
                    <td className="text-xs max-w-64">
                      <Src name={a.source_name} url={a.source_url || undefined} /> {a.published && <span className="text-muted">({a.published})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card eyebrow="Tax" title="Tax rules">
          <p className="text-sm text-ink-2 mb-2">{taxRules.label}. {taxRules.applies_to}</p>
          <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1">
            {taxRules.confidence_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <ul className="text-sm mt-3 space-y-1">
            {taxRules.sources.map((s) => (
              <li key={s.url}>
                <Src name={s.name} url={s.url} /> <span className="text-muted">({s.date})</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card eyebrow="Government & prices" title="Pay scale and inflation">
          <ul className="text-sm space-y-1">
            {[...payScale.sources, ...cpi.sources].map((s) => (
              <li key={s.url}>
                <Src name={s.name} url={s.url} /> <span className="text-muted">({s.date})</span>
              </li>
            ))}
          </ul>
          <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1 mt-3">
            {cpi.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>{payScale.increment_note}</li>
          </ul>
        </Card>

        <Card eyebrow="Caveats" title="Limitations">
          <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1.5">
            <li>Estimates, not offers. Pay varies a lot between individual companies, and the figures are monthly gross before tax.</li>
            <li>Nearly all figures are from Dhaka. Pay outside Dhaka uses assumed adjustments.</li>
            <li>
              Garment worker pay uses the Tk 12,500 minimum wage set in December 2023. A new minimum wage board was announced on 30 October 2026, and the figure will be updated once a new wage is gazetted (<a className="underline" href="https://www.daily-sun.com/bangladesh/906332/minimum-wage-board-for-garment-workers-to-be-formed-on-sunday" target="_blank" rel="noopener noreferrer">Daily Sun</a>).
            </li>
            <li>Pharma medical promotion officers (MPOs), a large job category, are not included: no published MPO salary figure was found.</li>
            <li>Senior and manager pay is extrapolated from the shared experience curve and is less certain.</li>
            <li>Unilever, BAT, Grameenphone, bKash and several banks don&apos;t publish salaries; their figures are crowd-reported or from career blogs, with small samples.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
