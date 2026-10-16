"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import insights from "@/data/insights.json";
import { pct, tk } from "@/lib/format";

const NAV = [
  { href: "/check", label: "Salary check" },
  { href: "/tax", label: "Take-home & tax" },
  { href: "/offers", label: "Compare offers" },
  { href: "/job-post", label: "Job post check" },
  { href: "/govt", label: "Govt pay 2026" },
  { href: "/insights", label: "Insights" },
];

const eg = Object.fromEntries(insights.market.entry_by_group.map((r) => [r.group, r]));
const g9 = insights.govt_entry.find((g) => g.grade === 9)!;
const TICKER = [
  ["Inflation, Sep 2026", pct(insights.inflation.latest_point_to_point.rate, 2)],
  ["Tax-free salary", `${tk(insights.tax.tax_free_monthly_salary.general)}/mo`],
  ["MNC FMCG trainee", tk(eg.mnc_fmcg.entry_p50)],
  ["Large bank MTO", tk(eg.large_bank.entry_p50)],
  ["Mobile operator trainee", tk(eg.telecom.entry_p50)],
  ["Top software, entry", tk(eg.top_software.entry_p50)],
  ["BCS Grade 9 (full scale)", tk(g9.monthly)],
  ["Large local company trainee", tk(eg.local_conglomerate.entry_p50)],
  ["RMG minimum wage", tk(12500)],
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-line">
      <div className="bg-brand text-brand-ink overflow-hidden" aria-label="Market numbers">
        <div className="ticker-track flex w-max gap-8 py-1.5 px-4 text-xs whitespace-nowrap num">
          {[...TICKER, ...TICKER].map(([k, v], i) => (
            <span key={i} aria-hidden={i >= TICKER.length} className="opacity-90">
              <span className="opacity-70">{k}</span> <strong className="font-semibold">{v}</strong>
            </span>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gold-2 text-[#141b2d] font-serif text-lg font-semibold">
            ৳
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">Salary Compass</span>
        </Link>
        <nav aria-label="Tools" className="hidden md:block">
          <ul className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={path === n.href ? "page" : undefined}
                  className={`block px-3 py-1.5 rounded-md ${path === n.href ? "bg-surface-2 text-ink font-medium" : "text-ink-2 hover:text-ink"}`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <nav aria-label="Tools" className="md:hidden overflow-x-auto px-2 pb-2">
        <ul className="flex gap-1 text-sm whitespace-nowrap">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={path === n.href ? "page" : undefined}
                className={`block px-3 py-1.5 rounded-md ${path === n.href ? "bg-brand text-brand-ink" : "text-ink-2 bg-surface"}`}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
