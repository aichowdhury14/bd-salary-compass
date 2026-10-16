"use client";

import { useMemo, useState } from "react";
import { defaultOffer, valueOffer, type Offer } from "@/lib/offers";
import { tk } from "@/lib/format";
import { TAX_CATEGORIES, type TaxCategory } from "@/lib/tax";
import { Card, Checkbox, Note, NumberInput, Select } from "@/components/ui";

function OfferForm({ offer, onChange, onRemove }: { offer: Offer; onChange: (o: Offer) => void; onRemove?: () => void }) {
  const set = <K extends keyof Offer>(k: K, v: Offer[K]) => onChange({ ...offer, [k]: v });
  return (
    <Card
      title={offer.name}
      aside={
        onRemove && (
          <button onClick={onRemove} className="text-xs text-muted hover:text-bad" aria-label={`Remove ${offer.name}`}>
            Remove
          </button>
        )
      }
    >
      <div className="grid gap-3">
        <NumberInput label="Monthly gross" value={offer.monthlyGross} onChange={(v) => set("monthlyGross", v)} prefix="৳" step={1000} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Basic share" value={Math.round(offer.basicShare * 100)} onChange={(v) => set("basicShare", v / 100)} suffix="%" max={100} />
          <NumberInput label="Festival bonuses" value={offer.festivalBonuses} onChange={(v) => set("festivalBonuses", v)} suffix="× basic" max={6} />
        </div>
        <NumberInput label="Performance bonus (yearly)" value={offer.performanceBonusAnnual} onChange={(v) => set("performanceBonusAnnual", v)} prefix="৳" step={5000} />
        <NumberInput label="Provident fund (each side)" value={Math.round(offer.pfRate * 100)} onChange={(v) => set("pfRate", v / 100)} suffix="% of basic" max={20} hint="0 if there is no PF" />
        <NumberInput label="Other benefits (yearly value)" value={offer.otherBenefitsAnnual} onChange={(v) => set("otherBenefitsAnnual", v)} prefix="৳" step={5000} hint="Health insurance, lunch, transport, phone" />
        <NumberInput label="Commute cost (monthly)" value={offer.commuteMonthly} onChange={(v) => set("commuteMonthly", v)} prefix="৳" step={500} />
        <Checkbox label="Gratuity (one basic per year of service)" checked={offer.gratuity} onChange={(v) => set("gratuity", v)} />
      </div>
    </Card>
  );
}

export function OffersTool() {
  const [offers, setOffers] = useState<Offer[]>([
    { ...defaultOffer("Current job", 60000), pfRate: 0.1, gratuity: true, commuteMonthly: 3000 },
    { ...defaultOffer("New offer", 72000), pfRate: 0, festivalBonuses: 2, commuteMonthly: 6000 },
  ]);
  const [category, setCategory] = useState<TaxCategory>("general");
  const values = useMemo(() => offers.map((o) => valueOffer(o, category)), [offers, category]);

  const bestTotal = values.reduce((bi, v, i) => (v.annualTotalValue > values[bi].annualTotalValue ? i : bi), 0);
  const bestCash = values.reduce((bi, v, i) => (v.takeHomeMonthlyAvg > values[bi].takeHomeMonthlyAvg ? i : bi), 0);
  const sorted = [...values].sort((a, b) => b.annualTotalValue - a.annualTotalValue);
  const margin = sorted.length > 1 ? sorted[0].annualTotalValue - sorted[1].annualTotalValue : 0;

  const rows: { label: string; key: keyof (typeof values)[number]; neg?: boolean; hint?: string }[] = [
    { label: "Basic (monthly)", key: "basic" },
    { label: "Cash income (yearly)", key: "annualCash", hint: "gross × 12 + festival + performance bonus" },
    { label: "Income tax (yearly)", key: "tax", neg: true },
    { label: "Your PF contribution (yearly)", key: "employeePf" },
    { label: "Employer PF (yearly)", key: "employerPf" },
    { label: "Gratuity earned (yearly)", key: "gratuityAccrual" },
    { label: "Average monthly take-home", key: "takeHomeMonthlyAvg" },
    { label: "Total yearly value", key: "annualTotalValue", hint: "take-home + PF both sides + gratuity + benefits − commute" },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {offers.map((o, i) => (
          <OfferForm
            key={i}
            offer={o}
            onChange={(n) => setOffers(offers.map((x, j) => (j === i ? n : x)))}
            onRemove={offers.length > 2 ? () => setOffers(offers.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        {offers.length < 3 && (
          <button
            onClick={() => setOffers([...offers, defaultOffer(`Offer ${offers.length + 1}`, 65000)])}
            className="rounded-xl border-2 border-dashed border-line text-ink-2 min-h-32 hover:border-gold-2 hover:text-gold"
          >
            + Add another offer
          </button>
        )}
      </div>

      <Card title="Side by side" aside={<div className="w-56"><Select<TaxCategory> label="Tax category" value={category} onChange={setCategory} options={TAX_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} /></div>}>
        <div className="relative overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm tabular min-w-[480px]">
            <thead>
              <tr className="text-left text-ink-2 border-b border-line">
                <th className="py-2 px-4 sm:px-0 font-medium">Per year unless stated</th>
                {offers.map((o, i) => (
                  <th key={i} className="py-2 px-2 text-right font-semibold text-ink">
                    {o.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`border-b border-line ${r.key === "annualTotalValue" ? "font-semibold" : ""}`}>
                  <td className="py-2 px-4 sm:px-0">
                    {r.label}
                    {r.hint && <span className="block text-xs text-muted font-normal">{r.hint}</span>}
                  </td>
                  {values.map((v, i) => {
                    const best = (r.key === "annualTotalValue" && i === bestTotal) || (r.key === "takeHomeMonthlyAvg" && i === bestCash);
                    return (
                      <td key={i} className={`py-2 px-2 text-right ${best ? "text-good" : ""}`}>
                        {r.neg ? "−" : ""}
                        {tk(v[r.key])}
                        {best && <span className="sr-only"> (best)</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Note>
            <strong className="text-ink">{offers[bestTotal].name}</strong> is worth the most overall,{" "}
            {margin > 0 ? <>by {tk(margin)} a year ({tk(margin / 12)} a month)</> : "tied with another offer"}.
            {bestCash !== bestTotal && (
              <>
                {" "}
                <strong className="text-ink">{offers[bestCash].name}</strong> puts more cash in your hand each month. The difference is
                in savings (PF, gratuity), which you only get if you stay long enough to be eligible.
              </>
            )}
          </Note>
        </div>
        <p className="text-xs text-muted mt-3">
          Assumes the employer matches your PF contribution, and treats employer PF as outside taxable salary. Gratuity usually needs
          about 5 years of service before it is paid; check the offer letter.
        </p>
      </Card>
    </div>
  );
}
