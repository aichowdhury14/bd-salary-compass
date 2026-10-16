// Bangladesh income tax on salary. Mirrors pipeline/salary_compass/tax.py and is checked
// against the same generated vectors (src/data/tax_test_vectors.json).
import rulesJson from "@/data/tax_rules.json";

export type TaxCategory = "general" | "woman_or_senior" | "disabled" | "third_gender" | "freedom_fighter";

export const TAX_CATEGORIES: { id: TaxCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "woman_or_senior", label: "Woman, or aged 65+" },
  { id: "disabled", label: "Person with disability" },
  { id: "third_gender", label: "Third gender" },
  { id: "freedom_fighter", label: "Gazetted war-wounded freedom fighter / July warrior" },
];

export type TaxRules = typeof rulesJson;
export const taxRules: TaxRules = rulesJson;

export interface TaxInput {
  annualSalary: number;
  category?: TaxCategory;
  parentOfDisabled?: boolean;
  eligibleInvestment?: number;
  newTaxpayer?: boolean;
}

export interface SlabLine {
  rate: number;
  amount: number;
  tax: number;
}

export interface TaxResult {
  gross: number;
  exemption: number;
  taxableIncome: number;
  threshold: number;
  slabLines: SlabLine[];
  grossTax: number;
  rebate: number;
  maxRebate: number;
  investmentForMaxRebate: number;
  minimumTaxApplied: boolean;
  netTax: number;
  effectiveRate: number;
  marginalRate: number;
}

export function computeTax(input: TaxInput, rules: TaxRules = taxRules): TaxResult {
  const category = input.category ?? "general";
  const gross = Math.max(0, input.annualSalary);
  const ex = rules.employment_exemption;
  const exemption = Math.min(gross * ex.fraction, ex.cap);
  const taxable = gross - exemption;

  let threshold = rules.thresholds[category];
  if (input.parentOfDisabled) threshold += rules.parent_of_disabled_extra;

  const slabLines: SlabLine[] = [];
  let remaining = Math.max(0, taxable - threshold);
  let marginalRate = 0;
  for (const slab of rules.slabs) {
    if (remaining <= 0) break;
    const width = slab.width ?? remaining;
    const amount = Math.min(remaining, width);
    slabLines.push({ rate: slab.rate, amount, tax: amount * slab.rate });
    marginalRate = slab.rate;
    remaining -= amount;
  }
  const grossTax = slabLines.reduce((s, l) => s + l.tax, 0);

  const rb = rules.rebate;
  const maxRebate = Math.min(taxable * rb.income_rate, rb.cap);
  const rebate = Math.min(maxRebate, Math.max(0, input.eligibleInvestment ?? 0) * rb.investment_rate, grossTax);
  let net = grossTax - rebate;

  let minimumTaxApplied = false;
  if (taxable > threshold) {
    const floor = input.newTaxpayer ? rules.minimum_tax.new_taxpayer : rules.minimum_tax.regular;
    if (net < floor) {
      net = floor;
      minimumTaxApplied = true;
    }
  }
  net = Math.round(net);
  const usefulRebate = Math.min(maxRebate, grossTax);
  return {
    gross,
    exemption: Math.round(exemption),
    taxableIncome: Math.round(taxable),
    threshold,
    slabLines,
    grossTax: Math.round(grossTax),
    rebate: Math.round(rebate),
    maxRebate: Math.round(usefulRebate),
    investmentForMaxRebate: Math.round(usefulRebate / rb.investment_rate),
    minimumTaxApplied,
    netTax: net,
    effectiveRate: gross ? net / gross : 0,
    marginalRate,
  };
}

/** Largest monthly gross (12 months, no bonus) that pays no tax. */
export function taxFreeMonthlySalary(category: TaxCategory = "general", rules: TaxRules = taxRules): number {
  const ex = rules.employment_exemption;
  const threshold = rules.thresholds[category];
  const byFraction = threshold / (1 - ex.fraction);
  const annual = byFraction * ex.fraction <= ex.cap ? byFraction : threshold + ex.cap;
  return annual / 12;
}
