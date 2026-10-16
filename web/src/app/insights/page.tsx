import type { Metadata } from "next";
import Link from "next/link";
import insights from "@/data/insights.json";
import { pct, tk } from "@/lib/format";
import { Card, PageTitle, Stat } from "@/components/ui";
import { EmployerChart, FunctionChart, PayScaleChart, TaxChart } from "./InsightsCharts";

export const metadata: Metadata = {
  title: "Salary insights",
  description: "What fresh graduates earn at Unilever-type multinationals, banks, telecoms and local companies; what each job pays; the 2026 pay scale after inflation; and income tax.",
};

export default function Page() {
  const infl = insights.inflation;
  const v = insights.validation;
  const eg = Object.fromEntries(insights.market.entry_by_group.map((r) => [r.group, r]));
  return (
    <>
      <PageTitle eyebrow="Insights · October 2026" title="The Bangladesh pay market in four charts" bn="বাজার বিশ্লেষণ">
        Pay in Bangladesh depends most on where you work, then on your job and your years of experience. Here is what the data
        says.
      </PageTitle>

      <Card className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Stat label="MNC FMCG trainee" value={tk(eg.mnc_fmcg.entry_p50)} sub="Unilever, BAT and similar" tone="gold" />
          <Stat label="Large local company" value={tk(eg.local_conglomerate.entry_p50)} sub="trainee / officer" />
          <Stat label="Inflation, Sep 2026" value={pct(infl.latest_point_to_point.rate, 2)} sub="raise below this = pay cut" tone="warn" />
          <Stat label="Lost since 2022" value={pct(infl.purchasing_power_lost_if_frozen_since_2022)} sub="buying power, if your pay was frozen" tone="bad" />
        </div>
      </Card>

      <div className="grid gap-6">
        <EmployerChart />
        <FunctionChart />
        <PayScaleChart />
        <TaxChart />
        <Card eyebrow="Method" title="How reliable is this?">
          <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1.5">
            <li>
              Built from <strong className="text-ink">{insights.market.n_anchors} published salary figures</strong> ({insights.market.n_sources} sources): bank MTO circulars, Glassdoor and Levels.fyi data for named employers, the minimum-wage gazette, and recruiter guides.
            </li>
            <li>
              Test: each figure is predicted from all the others. The typical error is <strong className="text-ink">{v.median_abs_pct_error}%</strong>. Job circulars are reproduced within about {v.by_source_type.job_circular}%.
            </li>
            <li>Every estimate shows a confidence label. Employers that don&apos;t publish salaries (Unilever, BAT, GP) rely on small crowd-reported samples.</li>
          </ul>
          <p className="text-sm mt-3">
            <Link href="/methodology" className="underline">All sources and the method</Link>
          </p>
        </Card>
      </div>
    </>
  );
}
