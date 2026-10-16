import { computeTax, type TaxCategory } from "./tax";

export interface Offer {
  name: string;
  monthlyGross: number;
  basicShare: number; // basic as a share of gross (BD packages are usually 50-60%)
  festivalBonuses: number; // number of basics paid as festival bonus per year
  performanceBonusAnnual: number;
  pfRate: number; // provident fund contribution as share of basic, by employee and matched by employer
  gratuity: boolean; // one basic per completed year of service
  otherBenefitsAnnual: number; // health insurance, lunch, transport, phone...
  commuteMonthly: number;
}

export const defaultOffer = (name: string, monthlyGross = 60000): Offer => ({
  name,
  monthlyGross,
  basicShare: 0.6,
  festivalBonuses: 2,
  performanceBonusAnnual: 0,
  pfRate: 0.1,
  gratuity: false,
  otherBenefitsAnnual: 0,
  commuteMonthly: 0,
});

export interface OfferValue {
  basic: number;
  annualCash: number;
  tax: number;
  employeePf: number;
  employerPf: number;
  gratuityAccrual: number;
  takeHomeMonthlyAvg: number;
  annualTotalValue: number;
}

export function valueOffer(o: Offer, category: TaxCategory = "general"): OfferValue {
  const basic = o.monthlyGross * o.basicShare;
  const annualCash = o.monthlyGross * 12 + basic * o.festivalBonuses + o.performanceBonusAnnual;
  const employeePf = basic * o.pfRate * 12;
  const employerPf = employeePf; // matched contribution, assumed outside taxable salary
  const tax = computeTax({ annualSalary: annualCash, category, eligibleInvestment: employeePf }).netTax;
  const gratuityAccrual = o.gratuity ? basic : 0;
  const takeHome = annualCash - tax - employeePf;
  return {
    basic: Math.round(basic),
    annualCash: Math.round(annualCash),
    tax,
    employeePf: Math.round(employeePf),
    employerPf: Math.round(employerPf),
    gratuityAccrual: Math.round(gratuityAccrual),
    takeHomeMonthlyAvg: Math.round(takeHome / 12),
    annualTotalValue: Math.round(takeHome + employeePf + employerPf + gratuityAccrual + o.otherBenefitsAnnual - o.commuteMonthly * 12),
  };
}
