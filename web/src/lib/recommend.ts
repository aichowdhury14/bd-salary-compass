// Recommendation engine: turns the salary model, tax rules and inflation into a few plain,
// ranked next steps. Runs in the browser; nothing leaves the device.
import cpiJson from "@/data/cpi.json";
import {
  bench,
  group,
  jobFunction,
  percentileOf,
  statsForYears,
  verdictFor,
  type Breakdown,
  type CellStats,
  type CityId,
  type LevelId,
} from "./benchmark";
import { monthName, pct, tk } from "./format";
import { computeTax } from "./tax";

export interface Profile {
  functionId: string;
  groupId: string;
  company?: string;
  /** Experience that counts at this employer type (see effectiveYears). */
  years: number;
  level: LevelId;
  city: CityId;
  monthlyGross: number;
}

export type RecKind = "negotiate" | "promotion" | "employer" | "role" | "tax" | "inflation";

export interface Recommendation {
  kind: RecKind;
  title: string;
  detail: string;
  /** Estimated change in monthly gross (or monthly-equivalent tax saving). */
  monthlyImpact: number;
  bullets?: string[];
}

export interface Assessment {
  stats: CellStats & { breakdown: Breakdown };
  percentile: number;
  verdict: ReturnType<typeof verdictFor>;
  gapToMedian: number;
  recommendations: Recommendation[];
}

const INFLATION = cpiJson.latest_point_to_point.rate;

export function assess(p: Profile): Assessment {
  const fn = jobFunction(p.functionId);
  const g = group(p.groupId);
  const stats = statsForYears(p.functionId, p.groupId, p.years, p.city);
  const percentile = percentileOf(p.monthlyGross, stats);
  const verdict = verdictFor(percentile);
  const recs: Recommendation[] = [];
  const pay = Math.max(p.monthlyGross, 1);

  // 1. Negotiate towards the median (or the top quarter if already above it).
  if (p.monthlyGross < stats.p50) {
    recs.push({
      kind: "negotiate",
      title: `Ask for about ${tk(stats.p50)}`,
      detail: `That's the typical pay for your job and experience at this kind of employer (${g.label}), and a ${pct(stats.p50 / pay - 1)} raise for you. Bring your results and ask for a band of ${tk(stats.p50)}–${tk(stats.p75)}.`,
      monthlyImpact: stats.p50 - p.monthlyGross,
    });
  } else if (p.monthlyGross < stats.p75) {
    recs.push({
      kind: "negotiate",
      title: `Aim for ${tk(stats.p75)} at your next review`,
      detail: `You're already above the typical pay. The top quarter of people in this job earn ${tk(stats.p75)} or more, and you need measurable results to make that case.`,
      monthlyImpact: stats.p75 - p.monthlyGross,
    });
  }

  // 2. Where the same job leads in three more years at this kind of employer.
  if (p.years < 12) {
    const ns = statsForYears(p.functionId, p.groupId, p.years + 3, p.city);
    if (ns.p50 > p.monthlyGross) {
      recs.push({
        kind: "promotion",
        title: `With 3 more years' experience, this job pays about ${tk(ns.p50)}`,
        detail: "To get there faster, build the skills employers ask for at the next level:",
        monthlyImpact: ns.p50 - p.monthlyGross,
        bullets: fn.skills.slice(0, 4),
      });
    }
  }

  // 3. Same job at a better-paying kind of employer (only where the estimate is not low-confidence).
  //    General officer / programme roles are only comparable within a sector (a bank officer is not an FMCG trainee).
  const sectorBound = bench.sector_bound_functions.includes(p.functionId);
  const better = Object.keys(fn.cells)
    .filter((gid) => !sectorBound || group(gid).sector === g.sector)
    .map((gid) => ({ gid, s: statsForYears(p.functionId, gid, p.years, p.city) }))
    .filter(({ gid, s }) => gid !== p.groupId && s.confidence !== "low")
    .sort((a, b) => b.s.p50 - a.s.p50)[0];
  if (better && better.s.p50 > Math.max(p.monthlyGross, stats.p50) * 1.15) {
    const bg = group(better.gid);
    recs.push({
      kind: "employer",
      title: `${bg.label}: about ${tk(better.s.p50)} for the same job`,
      detail: `${pct(better.s.p50 / pay - 1)} more than you earn now. Employers in this group include ${bg.companies.slice(0, 4).join(", ")}. They usually screen hard on English, case or technical interviews, and results you can put numbers on.`,
      monthlyImpact: better.s.p50 - p.monthlyGross,
    });
  }

  // 4. A neighbouring job at the same employer group, reachable with a skill bridge.
  for (const adj of fn.adjacent) {
    const other = bench.functions[adj.function];
    if (!other?.cells[p.groupId]) continue;
    const s = statsForYears(adj.function, p.groupId, p.years, p.city);
    if (s.confidence !== "low" && s.p50 > Math.max(p.monthlyGross, stats.p50) * 1.08) {
      recs.push({
        kind: "role",
        title: `Moving into ${other.short.toLowerCase()} pays about ${tk(s.p50)} here`,
        detail: "Skills that bridge the gap:",
        monthlyImpact: s.p50 - p.monthlyGross,
        bullets: adj.bridge,
      });
    }
  }

  // 5. Tax rebate.
  const t = computeTax({ annualSalary: p.monthlyGross * 12 });
  if (t.maxRebate > 0) {
    const withInv = computeTax({ annualSalary: p.monthlyGross * 12, eligibleInvestment: t.investmentForMaxRebate });
    const saving = t.netTax - withInv.netTax;
    if (saving > 0) {
      recs.push({
        kind: "tax",
        title: `Cut your tax by ${tk(saving)} a year`,
        detail: `Invest about ${tk(t.investmentForMaxRebate / 12)} a month (${tk(t.investmentForMaxRebate)} a year) in DPS, savings certificates, listed shares or mutual funds, life insurance, or your own provident fund.`,
        monthlyImpact: saving / 12,
      });
    }
  }

  // 6. Inflation floor.
  recs.push({
    kind: "inflation",
    title: `Any raise under ${tk(p.monthlyGross * INFLATION)} a month is a real pay cut`,
    detail: `Prices rose ${pct(INFLATION, 2)} in the year to ${monthName(cpiJson.latest_point_to_point.month)} (BBS). Treat that as the floor in your appraisal.`,
    monthlyImpact: 0,
  });

  recs.sort((a, b) => (a.kind === "inflation" ? 1 : b.kind === "inflation" ? -1 : b.monthlyImpact - a.monthlyImpact));
  return { stats, percentile, verdict, gapToMedian: stats.p50 - p.monthlyGross, recommendations: recs };
}
