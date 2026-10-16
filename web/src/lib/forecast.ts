// Salary forecast: where your pay could be in 5-30 years. Runs in the browser.
//
//   your pay in year t (today's taka) = your position vs market × market pay for (your experience + t) × (1 + real wage growth)^t
//   your pay in year t (future taka)  = today's-taka figure × (1 + inflation)^t
//
// * Career growth comes from the employer type's own experience curve (flat for banks, steep for MNC fast tracks).
//   That curve flattens after ~12 years, so later growth comes from the market, not seniority.
// * "Position vs market" is held constant: if you earn 6% below typical today, you stay 6% below.
import { statsForYears, levelForYears, levelLabel, type CityId } from "./benchmark";

export const HORIZONS = [5, 7, 10, 12, 15, 20, 25, 30] as const;
export const CAREER_LENGTH = 38; // years; most careers in Bangladesh end around age 59-62

export interface ForecastInput {
  functionId: string;
  groupId: string;
  city: CityId;
  years: number; // experience that counts today
  totalYears?: number; // actual total work experience today (for display / career length); defaults to years
  monthlyGross: number;
  inflation: number; // e.g. 0.06
  realGrowth: number; // market wage growth above inflation, e.g. 0.01
  startYear?: number;
}

export interface ForecastPoint {
  t: number;
  year: number;
  experience: number; // total work experience in that year
  countedExperience: number; // experience that counts at this employer type
  levelLabel: string;
  youReal: number;
  youNominal: number;
  marketReal: number;
  marketNominal: number;
  p25Nominal: number;
  p75Nominal: number;
  p25Real: number;
  p75Real: number;
  careerMultiplier: number; // market pay at (experience + t) / market pay now, today's money, before market growth
  pastCareer: boolean;
}

export interface Forecast {
  ratio: number; // your pay / market typical today
  points: ForecastPoint[]; // t = 0..30
  horizons: ForecastPoint[];
}

const round = (v: number, step = 500) => Math.round(v / step) * step;

export function forecast(inp: ForecastInput): Forecast {
  const startYear = inp.startYear ?? new Date().getFullYear();
  const inflation = Math.min(0.25, Math.max(0, inp.inflation));
  const realGrowth = Math.min(0.1, Math.max(-0.05, inp.realGrowth));
  const now = statsForYears(inp.functionId, inp.groupId, inp.years, inp.city);
  const marketNow = Math.exp(now.mu);
  const ratio = Math.min(4, Math.max(0.2, inp.monthlyGross > 0 ? inp.monthlyGross / marketNow : 1));

  const total = Math.max(inp.totalYears ?? inp.years, inp.years);
  const points: ForecastPoint[] = [];
  for (let t = 0; t <= 30; t++) {
    const exp = inp.years + t;
    const s = statsForYears(inp.functionId, inp.groupId, exp, inp.city);
    const market = Math.exp(s.mu);
    const realFactor = (1 + realGrowth) ** t;
    const priceFactor = (1 + inflation) ** t;
    const z = 0.6745 * s.sigma;
    const marketReal = market * realFactor;
    const youReal = ratio * marketReal;
    points.push({
      t,
      year: startYear + t,
      experience: total + t,
      countedExperience: exp,
      levelLabel: levelLabel(levelForYears(exp)),
      youReal: round(youReal),
      youNominal: round(youReal * priceFactor),
      marketReal: round(marketReal),
      marketNominal: round(marketReal * priceFactor),
      p25Real: round(marketReal * Math.exp(-z)),
      p75Real: round(marketReal * Math.exp(z)),
      p25Nominal: round(marketReal * Math.exp(-z) * priceFactor),
      p75Nominal: round(marketReal * Math.exp(z) * priceFactor),
      careerMultiplier: market / marketNow,
      pastCareer: total + t > CAREER_LENGTH,
    });
  }
  return { ratio, points, horizons: HORIZONS.map((h) => points[h]) };
}

/** Compound annual growth rate between two values over n years. */
export function cagr(from: number, to: number, years: number): number {
  return from > 0 && years > 0 ? (to / from) ** (1 / years) - 1 : 0;
}
