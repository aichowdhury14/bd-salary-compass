import benchJson from "@/data/benchmarks.json";
import { roundSalary } from "./format";

export type LevelId = "entry" | "junior" | "mid" | "senior" | "lead";
export type CityId = "dhaka" | "chattogram" | "other_city" | "district";
export type Confidence = "high" | "medium" | "low";

interface LevelCell {
  mu: number;
  se: number;
  confidence: Confidence;
  extra_sd: number;
}
interface GroupCell {
  confidence: Confidence;
  levels: Record<LevelId, LevelCell>;
}
export interface JobFunction {
  title: string;
  short: string;
  title_bn: string;
  about: string;
  sigma: number;
  keywords: string[];
  skills: string[];
  adjacent: { function: string; bridge: string[] }[];
  cells: Record<string, GroupCell>;
}
export interface EmployerGroup {
  id: string;
  label: string;
  label_bn: string;
  sector: string;
  companies: string[];
  functions: string[];
  match: string[];
  multiplier: number;
  experience_slope: number;
}

export const bench = benchJson as unknown as {
  levels: { id: LevelId; label: string; label_bn: string; min_years: number; max_years: number }[];
  cities: { id: CityId; label: string; label_bn: string; multiplier: number }[];
  city_note: string;
  match_order: string[];
  sector_bound_functions: string[];
  groups: EmployerGroup[];
  level_multipliers: Record<LevelId, number>;
  experience_credit: { same_job_other_employer: number; different_job: number; note: string };
  residual_sd: number;
  functions: Record<string, JobFunction>;
};

export const LEVEL_ORDER: LevelId[] = ["entry", "junior", "mid", "senior", "lead"];

export function group(id: string): EmployerGroup {
  const g = bench.groups.find((x) => x.id === id);
  if (!g) throw new Error(`unknown employer group ${id}`);
  return g;
}

export function jobFunction(id: string): JobFunction {
  const f = bench.functions[id];
  if (!f) throw new Error(`unknown job function ${id}`);
  return f;
}

/** Job functions we have an estimate for at this employer group, in taxonomy order. */
export function functionsFor(groupId: string): string[] {
  return group(groupId).functions.filter((f) => bench.functions[f]?.cells[groupId]);
}

export function levelForYears(years: number): LevelId {
  if (years < 1) return "entry";
  if (years < 3) return "junior";
  if (years < 6) return "mid";
  if (years < 10) return "senior";
  return "lead";
}

export interface CellStats {
  mu: number;
  sigma: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  confidence: Confidence;
}

const Z = { p10: -1.2816, p25: -0.6745, p75: 0.6745, p90: 1.2816 };

export function cellStats(functionId: string, level: LevelId, groupId: string, city: CityId = "dhaka"): CellStats {
  const fn = jobFunction(functionId);
  const cell = fn.cells[groupId];
  if (!cell) throw new Error(`no estimate for ${functionId} at ${groupId}`);
  const lv = cell.levels[level];
  const cityMult = bench.cities.find((c) => c.id === city)?.multiplier ?? 1;
  const mu = lv.mu + Math.log(cityMult);
  const sigma = Math.sqrt(fn.sigma ** 2 + lv.se ** 2 + lv.extra_sd ** 2);
  const q = (z: number) => roundSalary(Math.exp(mu + z * sigma));
  return { mu, sigma, p10: q(Z.p10), p25: q(Z.p25), p50: q(0), p75: q(Z.p75), p90: q(Z.p90), confidence: lv.confidence };
}

/** Abramowitz & Stegun 7.1.26 (max error 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Share (0-100) of comparable people estimated to earn less than `salary`. */
export function percentileOf(salary: number, stats: Pick<CellStats, "mu" | "sigma">): number {
  if (salary <= 0) return 0;
  const z = (Math.log(salary) - stats.mu) / stats.sigma;
  return 50 * (1 + erf(z / Math.SQRT2));
}

export type VerdictId = "below" | "within" | "above";
export function verdictFor(percentile: number): { id: VerdictId; label: string; headline: string } {
  if (percentile < 25) return { id: "below", label: "Below market", headline: "below the market" };
  if (percentile > 75) return { id: "above", label: "Above market", headline: "above the market" };
  return { id: "within", label: "Fair range", headline: "in the fair range" };
}

export function levelLabel(id: LevelId): string {
  return bench.levels.find((l) => l.id === id)?.label ?? id;
}
export function cityLabel(id: CityId): string {
  return bench.cities.find((c) => c.id === id)?.label ?? id;
}

// ---------------------------------------------------------------- experience in years
/** Typical years of experience at the centre of each level; estimates are interpolated between them. */
export const LEVEL_CENTRE: Record<LevelId, number> = { entry: 0.5, junior: 2, mid: 4.5, senior: 8, lead: 12 };
const RANK: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };

function interpolate(cell: GroupCell, years: number): LevelCell {
  const y = Math.max(0, years);
  const pts = LEVEL_ORDER.map((l) => ({ x: LEVEL_CENTRE[l], c: cell.levels[l] }));
  if (y <= pts[0].x) return pts[0].c;
  if (y >= pts[pts.length - 1].x) return pts[pts.length - 1].c;
  const i = pts.findIndex((p, k) => y >= p.x && y <= pts[k + 1].x);
  const a = pts[i], b = pts[i + 1];
  const f = (y - a.x) / (b.x - a.x);
  const lerp = (u: number, v: number) => u + f * (v - u);
  const confidence = f < 0.15 ? a.c.confidence : f > 0.85 ? b.c.confidence : RANK[a.c.confidence] <= RANK[b.c.confidence] ? a.c.confidence : b.c.confidence;
  return { mu: lerp(a.c.mu, b.c.mu), se: lerp(a.c.se, b.c.se), extra_sd: lerp(a.c.extra_sd, b.c.extra_sd), confidence };
}

export interface Breakdown {
  freshMedian: number; // typical fresher pay for this job at this kind of employer, Dhaka
  experienceYears: number;
  experienceMultiplier: number;
  cityMultiplier: number;
  median: number;
  sigma: number;
}

/** Same as cellStats, but for an exact number of years (smooth between levels), with the calculation steps. */
export function statsForYears(functionId: string, groupId: string, years: number, city: CityId = "dhaka"): CellStats & { breakdown: Breakdown } {
  const fn = jobFunction(functionId);
  const cell = fn.cells[groupId];
  if (!cell) throw new Error(`no estimate for ${functionId} at ${groupId}`);
  const lv = interpolate(cell, years);
  const fresh = cell.levels.entry.mu;
  const cityMult = bench.cities.find((c) => c.id === city)?.multiplier ?? 1;
  const mu = lv.mu + Math.log(cityMult);
  const sigma = Math.sqrt(fn.sigma ** 2 + lv.se ** 2 + lv.extra_sd ** 2);
  const q = (z: number) => roundSalary(Math.exp(mu + z * sigma));
  return {
    mu, sigma, p10: q(Z.p10), p25: q(Z.p25), p50: q(0), p75: q(Z.p75), p90: q(Z.p90), confidence: lv.confidence,
    breakdown: {
      freshMedian: roundSalary(Math.exp(fresh)),
      experienceYears: years,
      experienceMultiplier: Math.exp(lv.mu - fresh),
      cityMultiplier: cityMult,
      median: roundSalary(Math.exp(mu)),
      sigma,
    },
  };
}

export interface ExperienceInput {
  totalYears: number;
  /** Years spent at this kind of employer (e.g. at banks), in any job. */
  yearsHere: number;
  /** Was the earlier work (at other kinds of employer) the same kind of job? */
  earlierSameJob: boolean;
}

/** Years that count towards pay at this employer type. Outside years count partly (an explicit assumption). */
export function effectiveYears(e: ExperienceInput): { years: number; here: number; other: number; credit: number } {
  const total = Math.max(0, Math.min(45, e.totalYears || 0));
  const here = Math.max(0, Math.min(total, e.yearsHere || 0));
  const other = total - here;
  const credit = e.earlierSameJob ? bench.experience_credit.same_job_other_employer : bench.experience_credit.different_job;
  return { years: here + other * credit, here, other, credit };
}

/** "34", "fewer than 1", "more than 99". */
export function peopleBelow(percentile: number): string {
  if (percentile < 1) return "fewer than 1";
  if (percentile > 99) return "more than 99";
  return String(Math.round(percentile));
}
