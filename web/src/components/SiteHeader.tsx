"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import insights from "@/data/insights.json";
import { pct, tk } from "@/lib/format";

const NAV = [
  { href: "/check", label: "Salary check", bn: "বেতন যাচাই" },
  { href: "/tax", label: "Take-home & tax", bn: "আয়কর ও হাতে পাওয়া বেতন" },
  { href: "/offers", label: "Compare offers", bn: "অফার তুলনা" },
  { href: "/job-post", label: "Job post check", bn: "বিজ্ঞপ্তি যাচাই" },
  { href: "/govt", label: "Govt pay 2026", bn: "সরকারি বেতন ২০২৬" },
  { href: "/insights", label: "Insights", bn: "বাজার বিশ্লেষণ" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const current = NAV.find((n) => n.href === path);

  // Close the phone menu with Escape, and whenever the page changes (e.g. the browser's back button).
  useEffect(() => setMenuOpen(false), [path]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
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
        {/* Phones: one button opens every tool, instead of a sideways strip that hid half of them */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="phone-menu"
          className="md:hidden ml-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium"
        >
          <span className="max-w-[9rem] truncate text-ink-2">{current?.label ?? "Tools"}</span>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {menuOpen && (
        <nav id="phone-menu" aria-label="Tools" className="md:hidden border-t border-line bg-bg px-3 pb-3 pt-2 shadow-[0_12px_24px_-12px_rgba(20,27,45,0.35)]">
          <ul className="grid gap-1.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={path === n.href ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-baseline justify-between gap-3 rounded-lg px-3.5 py-3 ${path === n.href ? "bg-brand text-brand-ink" : "bg-surface text-ink"}`}
                >
                  <span className="font-medium">{n.label}</span>
                  <span className={`text-sm ${path === n.href ? "opacity-80" : "text-ink-2"}`}>{n.bn}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
