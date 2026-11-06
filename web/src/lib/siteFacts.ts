// The AI coach's fact sheet, built from the same data files the pages use, so the chat can answer
// general questions on any page with the site's own figures instead of inventing them.
import insights from "@/data/insights.json";
import rules from "@/data/tax_rules.json";
import { pct, tk } from "./format";

export const PAGES = {
  "/": "Home",
  "/check": "Salary check",
  "/tax": "Take-home & tax",
  "/offers": "Compare offers",
  "/job-post": "Job post check",
  "/govt": "Govt pay 2026",
  "/insights": "Insights",
  "/methodology": "Methodology",
} as const;
export type PagePath = keyof typeof PAGES;

export function pageFor(pathname: string): PagePath {
  return pathname in PAGES ? (pathname as PagePath) : "/";
}

const TOOLS: [PagePath, string][] = [
  ["/check", "fair pay range for a job at a named employer, with next steps and a negotiation script"],
  ["/tax", "monthly take-home pay, income tax, and how much to invest to cut the tax"],
  ["/offers", "compares job offers including festival bonuses, provident fund, gratuity, tax and commute"],
  ["/job-post", "paste a job post (English or Bangla) to see if its pay is fair"],
  ["/govt", "government pay by grade and step under the National Pay Scale 2026"],
  ["/insights", "who pays fresh graduates most, pay by job, inflation"],
  ["/methodology", "how the estimates are made and sourced"],
];

const TAX_EXAMPLES = [50_000, 60_000, 80_000, 100_000, 150_000, 200_000];
const CATEGORY_LABELS: Record<string, string> = {
  general: "general",
  woman_or_senior: "women and people aged 65+",
  disabled: "persons with disability",
  third_gender: "third gender",
  freedom_fighter: "gazetted war-wounded freedom fighters and July warriors",
};

function build(): string {
  const m = insights.market;
  const v = insights.validation;
  const ex = rules.employment_exemption;
  const lines = [
    "WEBSITE TOOLS (link to them in Markdown, e.g. [Take-home & tax](/tax)):",
    ...TOOLS.map(([path, what]) => `- [${PAGES[path]}](${path}): ${what}`),
    "",
    `HOW THE ESTIMATES ARE MADE: ${m.n_anchors} published salary figures from ${m.n_sources} sources (bank job circulars, Glassdoor and Levels.fyi figures for named employers, the garment minimum-wage gazette, recruiter guides), combined by job, employer type, experience and city. Typical error about ${Math.round(v.median_abs_pct_error)}%. Nothing a visitor enters is stored.`,
    "",
    "FRESH-GRADUATE TYPICAL MONTHLY GROSS PAY, DHAKA (median, with the middle-half range):",
    ...m.entry_by_group.map(
      (g) => `- ${g.label} (${g.examples.slice(0, 3).join(", ")}), ${g.function_short.toLowerCase()}: ${tk(g.entry_p50)} (${tk(g.entry_p25)} to ${tk(g.entry_p75)})`,
    ),
    "",
    `INCOME TAX ON SALARY, ${rules.label}:`,
    `- Tax-free income per year: ${Object.entries(rules.thresholds)
      .map(([k, val]) => `${tk(val)} for ${CATEGORY_LABELS[k] ?? k}`)
      .join("; ")}.`,
    `- Salaried people first deduct the lower of one-third of gross salary or ${tk(ex.cap)}.`,
    `- Then slabs: ${rules.slabs.map((s, i) => (s.width ? `${i ? "next" : "first"} ${tk(s.width)} at ${pct(s.rate)}` : `the rest at ${pct(s.rate)}`)).join(", ")}.`,
    `- Investment rebate: the lowest of ${pct(rules.rebate.income_rate)} of taxable income, ${pct(rules.rebate.investment_rate)} of eligible investment (DPS, savings certificates, provident fund, listed shares), or ${tk(rules.rebate.cap)}.`,
    `- Minimum tax ${tk(rules.minimum_tax.regular)} once income is above the threshold (${tk(rules.minimum_tax.new_taxpayer)} for a first-time taxpayer).`,
    `- Salary tax-free up to about ${tk(insights.tax.tax_free_monthly_salary.general)} a month (general taxpayer, no bonus).`,
    `- Examples, general taxpayer, 12 months, no bonus or investment: ${insights.tax.curve
      .filter((c) => TAX_EXAMPLES.includes(c.monthly_gross))
      .map((c) => `${tk(c.monthly_gross)}/month pays ${tk(c.annual_tax)} a year`)
      .join("; ")}.`,
    "",
    `INFLATION: ${pct(insights.inflation.latest_point_to_point.rate, 2)} a year (point to point, ${insights.inflation.latest_point_to_point.month}). A raise below this is a pay cut in real terms.`,
  ];
  return lines.join("\n");
}

export const SITE_FACTS = build();
