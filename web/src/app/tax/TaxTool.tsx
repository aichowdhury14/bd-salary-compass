"use client";

import { useMemo, useState } from "react";
import { computeTax, taxRules, TAX_CATEGORIES, taxFreeMonthlySalary, type TaxCategory } from "@/lib/tax";
import { tk, pct } from "@/lib/format";
import { Card, Checkbox, Note, NumberInput, Select, Stat } from "@/components/ui";

export function TaxTool() {
  const [monthly, setMonthly] = useState(80000);
  const [basicPct, setBasicPct] = useState(60);
  const [festivals, setFestivals] = useState(2);
  const [otherBonus, setOtherBonus] = useState(0);
  const [pfPct, setPfPct] = useState(10);
  const [investment, setInvestment] = useState(0);
  const [category, setCategory] = useState<TaxCategory>("general");
  const [parent, setParent] = useState(false);
  const [newTaxpayer, setNewTaxpayer] = useState(false);

  const calc = useMemo(() => {
    const basic = (monthly * basicPct) / 100;
    const annual = monthly * 12 + basic * festivals + otherBonus;
    const pfAnnual = basic * (pfPct / 100) * 12;
    const totalInvestment = pfAnnual + investment;
    const r = computeTax({ annualSalary: annual, category, parentOfDisabled: parent, eligibleInvestment: totalInvestment, newTaxpayer });
    const best = computeTax({ annualSalary: annual, category, parentOfDisabled: parent, eligibleInvestment: r.investmentForMaxRebate, newTaxpayer });
    const monthlyTds = r.netTax / 12;
    const monthlyTakeHome = monthly - pfAnnual / 12 - monthlyTds;
    return { basic, annual, pfAnnual, totalInvestment, r, best, monthlyTds, monthlyTakeHome };
  }, [monthly, basicPct, festivals, otherBonus, pfPct, investment, category, parent, newTaxpayer]);

  const { r } = calc;
  const extraNeeded = Math.max(0, r.investmentForMaxRebate - calc.totalInvestment);
  const extraSaving = r.netTax - calc.best.netTax;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
      <Card title="Your salary" className="lg:sticky lg:top-28">
        <div className="grid gap-4">
          <NumberInput label="Monthly gross salary" value={monthly} onChange={setMonthly} prefix="৳" step={1000} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Basic share" value={basicPct} onChange={setBasicPct} suffix="%" max={100} hint="Of gross" />
            <NumberInput label="Festival bonuses" value={festivals} onChange={setFestivals} max={6} suffix="× basic" hint="Per year" />
          </div>
          <NumberInput label="Other bonus / incentive (yearly)" value={otherBonus} onChange={setOtherBonus} prefix="৳" step={1000} />
          <NumberInput label="Your provident fund contribution" value={pfPct} onChange={setPfPct} suffix="% of basic" max={20} hint="Counts as a tax-rebate investment" />
          <NumberInput
            label="Other tax-saving investment (yearly)"
            value={investment}
            onChange={setInvestment}
            prefix="৳"
            step={5000}
            hint="DPS, savings certificates, listed shares/mutual funds, life insurance premium"
          />
          <Select<TaxCategory> label="Taxpayer category" value={category} onChange={setCategory} options={TAX_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Checkbox label="Parent / guardian of a person with disability (+৳50,000)" checked={parent} onChange={setParent} />
          <Checkbox label="First-time taxpayer (minimum tax ৳1,000)" checked={newTaxpayer} onChange={setNewTaxpayer} />
        </div>
      </Card>

      <div className="grid gap-5 min-w-0">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Monthly take-home" value={tk(calc.monthlyTakeHome)} sub="after tax & PF, regular month" />
            <Stat label="Tax per month" value={tk(calc.monthlyTds)} sub="deducted at source (approx.)" />
            <Stat label="Tax per year" value={tk(r.netTax)} sub={`${pct(r.effectiveRate, 1)} of income`} />
            <Stat label="Marginal rate" value={pct(r.marginalRate)} sub="on your next taka" />
          </div>
        </Card>

        {extraSaving > 0 && (
          <Note>
            <strong className="text-ink">Tax-saving tip:</strong> invest another {tk(extraNeeded)} this year ({tk(extraNeeded / 12)} a month)
            in eligible schemes. That earns the full rebate of {tk(r.maxRebate)} and saves you {tk(extraSaving)} more in tax.
          </Note>
        )}

        <Card title="How your tax is calculated">
          <table className="w-full text-sm tabular">
            <tbody className="[&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-line">
              <tr>
                <td>Annual salary income</td>
                <td className="text-right">{tk(calc.annual)}</td>
              </tr>
              <tr>
                <td className="text-ink-2">
                  Less salary exemption (lower of ⅓ or {tk(taxRules.employment_exemption.cap)})
                </td>
                <td className="text-right text-ink-2">−{tk(r.exemption)}</td>
              </tr>
              <tr className="font-medium">
                <td>Taxable income</td>
                <td className="text-right">{tk(r.taxableIncome)}</td>
              </tr>
              <tr>
                <td className="text-ink-2">First {tk(r.threshold)} at 0%</td>
                <td className="text-right text-ink-2">{tk(0)}</td>
              </tr>
              {r.slabLines.map((l, i) => (
                <tr key={i}>
                  <td className="text-ink-2">
                    Next {tk(l.amount)} at {pct(l.rate)}
                  </td>
                  <td className="text-right text-ink-2">{tk(l.tax)}</td>
                </tr>
              ))}
              <tr>
                <td>Tax before rebate</td>
                <td className="text-right">{tk(r.grossTax)}</td>
              </tr>
              <tr>
                <td className="text-ink-2">
                  Less investment rebate (10% of {tk(calc.totalInvestment)}, capped at {tk(r.maxRebate)})
                </td>
                <td className="text-right text-ink-2">−{tk(r.rebate)}</td>
              </tr>
              {r.minimumTaxApplied && (
                <tr>
                  <td className="text-ink-2">Raised to the minimum tax</td>
                  <td className="text-right text-ink-2">{tk(r.netTax)}</td>
                </tr>
              )}
              <tr className="font-semibold">
                <td>Tax payable for the year</td>
                <td className="text-right">{tk(r.netTax)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted mt-3">
            Tax-free salary for your category: up to {tk(taxFreeMonthlySalary(category))} a month (no bonuses). Rules: {taxRules.label}.
          </p>
        </Card>

        <Note tone="warn">
          These rules follow the Finance Act 2026 as reported by tax advisers. Figures for some taxpayer categories differ between guides.
          Check NBR&apos;s published rules or ask a tax adviser before you file. Wealth surcharge and non-salary income are not included.
        </Note>
      </div>
    </div>
  );
}
