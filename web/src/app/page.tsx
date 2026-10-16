import Link from "next/link";
import insights from "@/data/insights.json";
import { pct, tk } from "@/lib/format";

const TOOLS = [
  { href: "/check", n: "01", title: "Salary check", bn: "বেতন যাচাই", text: "Pick your employer (Unilever, City Bank, GP, bKash...) and your job, and see if you're paid fairly. Includes next steps, a 30-year forecast and a ready-to-send negotiation script." },
  { href: "/tax", n: "02", title: "Take-home & tax", bn: "হাতে পাওয়া বেতন ও আয়কর", text: "What lands in your account each month, and how much to invest to cut your income tax (Finance Act 2026)." },
  { href: "/offers", n: "03", title: "Compare offers", bn: "অফার তুলনা", text: "Bonuses, provident fund, gratuity, tax and commute, side by side. The bigger gross is not always the better offer." },
  { href: "/job-post", n: "04", title: "Job post check", bn: "বিজ্ঞপ্তি যাচাই", text: "Paste any job post in English or Bangla to see if the pay is fair, or what to ask for when it says negotiable." },
  { href: "/govt", n: "05", title: "Govt pay 2026", bn: "সরকারি বেতন ২০২৬", text: "Basic pay, house rent and yearly total for every grade of the new National Pay Scale, phase by phase." },
  { href: "/insights", n: "06", title: "Insights", bn: "বাজার বিশ্লেষণ", text: "Who pays fresh graduates the most, what each job pays, and what inflation did to salaries." },
];

export default function Home() {
  const eg = Object.fromEntries(insights.market.entry_by_group.map((r) => [r.group, r]));
  const g9 = insights.govt_entry.find((g) => g.grade === 9)!;
  const slips = [
    { who: "Multinational FMCG trainee", eg: "Unilever, BAT, Nestlé", pay: eg.mnc_fmcg.entry_p50 },
    { who: "Large private bank MTO", eg: "City, MTB, DBBL, BRAC Bank", pay: eg.large_bank.entry_p50 },
    { who: "Government Grade 9", eg: "BCS cadre, full 2026 scale", pay: g9.monthly },
    { who: "Large local company trainee", eg: "PRAN-RFL, Square, ACI", pay: eg.local_conglomerate.entry_p50 },
    { who: "Small local business", eg: "SMEs, agencies", pay: eg.sme.entry_p50 },
  ];
  const max = Math.max(...slips.map((s) => s.pay));
  return (
    <>
      <section className="ledger -mx-4 sm:-mx-6 px-4 sm:px-6 py-8 sm:py-14 rounded-2xl grid gap-10 lg:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <p className="eyebrow mb-3">Bangladesh · salary data · 2026</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Same degree.
            <br />
            <span className="text-gold">Very different payslips.</span>
          </h1>
          <p className="text-lg text-ink-2 mt-3">একই ডিগ্রি, ভিন্ন ভিন্ন বেতন।</p>
          <p className="text-ink-2 mt-5 max-w-xl leading-relaxed">
            Where you work changes your pay more than anything else. Check your salary against people in the same job at banks,
            multinationals, telecoms, software companies, NGOs and local firms. Every figure comes from a published source.
            Your salary never leaves your device.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/check" className="rounded-lg bg-brand text-brand-ink px-5 py-3 font-medium">
              Check my salary →
            </Link>
            <Link href="/tax" className="rounded-lg border border-line bg-surface px-5 py-3 font-medium">
              Work out my take-home
            </Link>
          </div>
        </div>

        <figure className="rounded-xl border border-line bg-surface shadow-[0_1px_0_var(--line),0_12px_32px_-16px_rgba(20,27,45,0.25)]">
          <div className="px-5 pt-5 pb-3 flex items-baseline justify-between gap-4">
            <p className="eyebrow">Fresh graduate · monthly · Dhaka</p>
            <p className="eyebrow hidden sm:block">typical</p>
          </div>
          <ul>
            {slips.map((s) => (
              <li key={s.who} className="px-5 py-3 border-t border-dashed border-line">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{s.who}</p>
                    <p className="text-xs text-muted truncate">{s.eg}</p>
                  </div>
                  <p className="num font-semibold text-lg">{tk(s.pay)}</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-gold-2" style={{ width: `${(s.pay / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <figcaption className="px-5 py-3 border-t border-line text-xs text-muted">
            Model medians from {insights.market.n_anchors} published figures. <Link href="/insights" className="underline">See the data</Link>
          </figcaption>
        </figure>
      </section>

      <section aria-label="Tools" className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-xl border border-line bg-surface p-5 hover:border-gold-2 transition-colors">
            <p className="num text-xs text-gold">{t.n}</p>
            <h2 className="font-serif text-xl font-semibold mt-1 group-hover:text-gold">{t.title}</h2>
            <p className="text-xs text-muted">{t.bn}</p>
            <p className="text-sm text-ink-2 mt-3 leading-relaxed">{t.text}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-xl bg-brand text-brand-ink p-6 sm:p-8 grid sm:grid-cols-3 gap-6">
        <div>
          <p className="num text-3xl font-semibold">{pct(insights.inflation.latest_point_to_point.rate, 2)}</p>
          <p className="text-sm opacity-80 mt-1">Inflation in September 2026. Any raise below this is a pay cut in real terms.</p>
        </div>
        <div>
          <p className="num text-3xl font-semibold">{tk(insights.tax.tax_free_monthly_salary.general)}</p>
          <p className="text-sm opacity-80 mt-1">The highest monthly salary that pays no income tax under the 2026-27 rules.</p>
        </div>
        <div>
          <p className="num text-3xl font-semibold">{pct(insights.inflation.purchasing_power_lost_if_frozen_since_2022)}</p>
          <p className="text-sm opacity-80 mt-1">The buying power a salary has lost since July 2022 if it hasn&apos;t risen.</p>
        </div>
      </section>
    </>
  );
}
