// Small calculators behind the salary-check explanations: take-home pay, last raise vs
// inflation, and "what if" comparisons. All pure functions, run in the browser.
import cpi from "@/data/cpi.json";
import { bench, group, statsForYears, type CityId } from "./benchmark";
import { computeTax } from "./tax";

// ---------------------------------------------------------------- 1. take-home
export interface TakeHome {
  annualIncome: number; // 12 x gross + festival bonuses
  monthlyTax: number;
  pfMonthly: number;
  takeHome: number; // gross - tax (regular month, no PF)
  takeHomeWithPf: number; // gross - tax - employee PF
}

/** Typical Bangladeshi package: basic = 60% of gross, two festival bonuses of one basic each, PF 10% of basic. */
export function takeHome(monthlyGross: number, opts: { basicShare?: number; festivals?: number; pfRate?: number } = {}): TakeHome {
  const gross = Math.max(0, monthlyGross || 0);
  const basic = gross * (opts.basicShare ?? 0.6);
  const annualIncome = gross * 12 + basic * (opts.festivals ?? 2);
  const pfMonthly = basic * (opts.pfRate ?? 0.1);
  const noPf = computeTax({ annualSalary: annualIncome }).netTax;
  const withPf = computeTax({ annualSalary: annualIncome, eligibleInvestment: pfMonthly * 12 }).netTax; // PF earns the rebate
  return {
    annualIncome: Math.round(annualIncome),
    monthlyTax: Math.round(noPf / 12),
    pfMonthly: Math.round(pfMonthly),
    takeHome: Math.round(gross - noPf / 12),
    takeHomeWithPf: Math.round(gross - withPf / 12 - pfMonthly),
  };
}

// ---------------------------------------------------------------- 4. last raise vs inflation
export type RaiseVerdict = "beat" | "kept_up" | "lost";
export interface RaiseCheck {
  nominal: number; // e.g. 0.10
  inflation: number;
  real: number; // change in buying power
  verdict: RaiseVerdict;
  neededToKeepUp: number; // salary that would have just matched prices
  shortfall: number; // monthly amount below that (0 if beaten)
}

export const LAST_YEAR_INFLATION = cpi.latest_point_to_point.rate;

export function raiseCheck(lastYear: number, now: number, inflation = LAST_YEAR_INFLATION): RaiseCheck | null {
  if (!(lastYear > 0) || !(now > 0)) return null;
  const nominal = now / lastYear - 1;
  const real = (1 + nominal) / (1 + inflation) - 1;
  const needed = Math.round(lastYear * (1 + inflation));
  return {
    nominal,
    inflation,
    real,
    verdict: real > 0.005 ? "beat" : real >= -0.005 ? "kept_up" : "lost",
    neededToKeepUp: needed,
    shortfall: Math.max(0, needed - now),
  };
}

// ---------------------------------------------------------------- 2. what if
export interface WhatIfRow {
  key: string;
  label: string;
  sub?: string;
  typical: number;
  change: number; // vs your current typical pay
  current: boolean;
  confidence: "high" | "medium" | "low";
}

export interface WhatIf {
  employers: WhatIfRow[];
  experience: WhatIfRow[];
  cities: WhatIfRow[];
}

export function whatIf(p: { functionId: string; groupId: string; years: number; city: CityId }): WhatIf {
  const base = statsForYears(p.functionId, p.groupId, p.years, p.city).p50;
  const fn = bench.functions[p.functionId];
  const row = (key: string, label: string, s: { p50: number; confidence: "high" | "medium" | "low" }, current: boolean, sub?: string): WhatIfRow => ({
    key, label, sub, typical: s.p50, change: base ? s.p50 / base - 1 : 0, current, confidence: s.confidence,
  });

  // Employers: same job elsewhere. General officer/programme roles only compare within the same sector.
  const sectorBound = bench.sector_bound_functions.includes(p.functionId);
  const sector = group(p.groupId).sector;
  const employers = Object.keys(fn.cells)
    .filter((gid) => !sectorBound || group(gid).sector === sector)
    .map((gid) => {
      const g = group(gid);
      return row(gid, g.label, statsForYears(p.functionId, gid, p.years, p.city), gid === p.groupId, g.companies.slice(0, 3).join(", "));
    })
    .sort((a, b) => b.typical - a.typical);

  const experience = [0, 2, 5, 10]
    .filter((d) => d === 0 || p.years + d <= 40)
    .map((d) => row(`+${d}`, d === 0 ? `Now (${p.years.toFixed(1)} yrs)` : `+${d} years`, statsForYears(p.functionId, p.groupId, p.years + d, p.city), d === 0, d ? `${(p.years + d).toFixed(0)} yrs experience, today's money` : undefined));

  const cities = bench.cities.map((c) => row(c.id, c.label, statsForYears(p.functionId, p.groupId, p.years, c.id), c.id === p.city));
  return { employers, experience, cities };
}
