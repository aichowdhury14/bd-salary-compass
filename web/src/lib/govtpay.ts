import scaleJson from "@/data/pay_scale_2026.json";

export const payScale = scaleJson;
export type PhaseId = "p1" | "p2" | "full";
export type GovtLocation = "dhaka" | "other_city" | "elsewhere";

export const GOVT_LOCATIONS: { id: GovtLocation; label: string }[] = [
  { id: "dhaka", label: "Dhaka North / South City Corporation" },
  { id: "other_city", label: "Other city corporation, Savar or Cox's Bazar" },
  { id: "elsewhere", label: "Elsewhere" },
];

function grade(g: number) {
  const row = payScale.grades.find((r) => r.grade === g);
  if (!row) throw new Error(`grade ${g}`);
  return row;
}

/** Estimated basic steps: start, then +5% a year rounded to Tk 10, capped at the grade maximum. */
export function basicSteps(g: number, scale: "2015" | "2026" = "2026"): number[] {
  const row = grade(g);
  const start = scale === "2026" ? row.start_2026 : row.start_2015;
  const max = scale === "2026" ? row.max_2026 : row.max_2015;
  const steps = [start];
  while (steps[steps.length - 1] < max && steps.length < 30) {
    const next = Math.round((steps[steps.length - 1] * (1 + payScale.increment_rate)) / 10) * 10;
    steps.push(Math.min(next, max));
  }
  return steps;
}

export function phaseShare(g: number, phase: PhaseId): number {
  const p = payScale.phases.find((x) => x.id === phase)!;
  return g <= 9 ? p.share_grade_1_9 : p.share_grade_10_20;
}

export function houseRentRate(g: number, location: GovtLocation): number {
  const band = payScale.house_rent.bands.find((b) => g >= b.grades[0] && g <= b.grades[1])!;
  return band[location];
}

export interface GovtPackageInput {
  grade: number;
  step: number;
  phase: PhaseId;
  location: GovtLocation;
  over50: boolean;
  children: number;
}

export interface GovtPackage {
  basic2015: number;
  basicFull: number;
  basic: number;
  houseRent: number;
  medical: number;
  education: number;
  monthlyGross: number;
  festivalAnnual: number;
  boishakhiAnnual: number;
  annualTotal: number;
}

export function govtPackage(inp: GovtPackageInput): GovtPackage {
  const steps26 = basicSteps(inp.grade, "2026");
  const steps15 = basicSteps(inp.grade, "2015");
  const basicFull = steps26[Math.min(inp.step, steps26.length - 1)];
  const basic2015 = steps15[Math.min(inp.step, steps15.length - 1)];
  const share = phaseShare(inp.grade, inp.phase);
  const basic = Math.round(basic2015 + share * (basicFull - basic2015));
  const houseRent = Math.round(basic * houseRentRate(inp.grade, inp.location));
  const medical = inp.over50 ? payScale.medical.above_50 : payScale.medical.up_to_50;
  const education = Math.min(inp.children, payScale.education_allowance_max_children) * payScale.education_allowance_per_child;
  const monthlyGross = basic + houseRent + medical + education;
  const festivalAnnual = basic * payScale.festival_bonus_per_year_in_basics;
  const boishakhiAnnual = Math.round(basic * payScale.boishakhi_rate);
  return {
    basic2015,
    basicFull,
    basic,
    houseRent,
    medical,
    education,
    monthlyGross,
    festivalAnnual,
    boishakhiAnnual,
    annualTotal: monthlyGross * 12 + festivalAnnual + boishakhiAnnual,
  };
}
