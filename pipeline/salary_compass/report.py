"""Write reports/market-analysis.md from the analysis numbers (so the text never drifts from the data)."""

from __future__ import annotations

from datetime import date


def tk(v: float) -> str:
    return f"Tk {v:,.0f}"


def pct(v: float, digits: int = 0) -> str:
    return f"{v * 100:.{digits}f}%"


def render(a: dict, charts: list[str]) -> str:
    infl, ps, tax, mk, val = a["inflation"], a["payscale"], a["tax"], a["market"], a["validation"]
    g = {r["grade"]: r for r in ps["grades"]}
    curve = {c["monthly_gross"]: c for c in tax["curve"]}
    eg = {r["group"]: r for r in mk["entry_by_group"]}
    g9 = next(x for x in a["govt_entry"] if x["grade"] == 9)
    lm = mk["level_multipliers"]

    lines = [
        "# Bangladesh Salary Market Analysis, October 2026",
        "",
        f"_Generated {date.today().isoformat()} by `pipeline/build.py` from cited sources. All salaries are monthly gross in taka unless stated._",
        "",
        "## Key findings",
        "",
        f"1. **Where you start matters more than what you studied.** A fresh graduate on a multinational FMCG trainee programme (Unilever, BAT and similar) earns a median of about **{tk(eg['mnc_fmcg']['entry_p50'])}** a month, and a trainee at a large private bank (City, MTB, DBBL, BRAC Bank) about **{tk(eg['large_bank']['entry_p50'])}**. A trainee or officer at a large local company (PRAN-RFL, Square, ACI) starts near **{tk(eg['local_conglomerate']['entry_p50'])}**, and at a small business near **{tk(eg['sme']['entry_p50'])}**.",
        "2. **Bank trainee pay is the best-documented number in the market.** 2025-26 circulars show MTO training pay of Tk 60,000-85,000, rising to Tk 73,000-1,00,000 on confirmation after a year.",
        f"3. **In software, the employer decides.** Entry software engineers at most local IT companies earn a median of about {tk(eg['local_software']['entry_p50'])}. Top product companies (Optimizely, Cefalo, Therap, SELISE, Brain Station 23, Enosis) start near {tk(eg['top_software']['entry_p50'])}, and their Levels.fyi medians range from about Tk 81,000 (Enosis) to Tk 1,67,000 (Optimizely).",
        f"4. **Government jobs now compete for graduates.** At full implementation, Grade 9 (BCS cadre entry) is worth about **{tk(g9['monthly'])}** a month in Dhaka, including bonuses spread over the year. That is close to large-bank trainee pay, although the basic is only {tk(g9['phase1_basic'])} until December 2026.",
        f"5. **For grades 1-11, the 2026 pay scale doesn't fully restore 2015 buying power.** Prices rose {pct(infl['factor_jul2015_to_jun2026'] - 1)} between July 2015 and June 2026. Grades 1-11 got +100%, so their real starting basic is down {pct(-g[9]['real_change'], 1)}. Grades 12-20 got +115% to +142%, a real gain of {pct(g[12]['real_change'], 1)} to {pct(g[20]['real_change'], 1)}.",
        f"6. **A frozen salary has lost {pct(infl['purchasing_power_lost_if_frozen_since_2022'])} of its buying power since July 2022.** Inflation was still {pct(infl['latest_point_to_point']['rate'], 2)} in September 2026.",
        f"7. **Salary up to {tk(tax['tax_free_monthly_salary']['general'])} a month is tax-free** ({tk(tax['tax_free_monthly_salary']['woman_or_senior'])} for women and people 65+). At {tk(100000)} a month the tax is {tk(curve[100000]['annual_tax'])} a year. Investing {tk(curve[100000]['investment_for_max_rebate'])} in rebate-eligible schemes cuts it to {tk(curve[100000]['annual_tax_with_max_rebate'])}.",
        f"8. **How fast pay grows depends on the employer.** A large-bank officer goes from about {tk(mk['officer_curves']['large_bank']['entry'])} as a fresher to {tk(mk['officer_curves']['large_bank']['senior'])} at 6-9 years, roughly {mk['officer_curves']['large_bank']['senior'] / mk['officer_curves']['large_bank']['entry']:.1f}x. Published Senior Principal Officer figures (median about Tk 70,000 across banks) confirm that bank ladders are flat. A multinational FMCG fast track goes from {tk(mk['officer_curves']['mnc_fmcg']['entry'])} to about {tk(mk['officer_curves']['mnc_fmcg']['senior'])}, roughly {mk['officer_curves']['mnc_fmcg']['senior'] / mk['officer_curves']['mnc_fmcg']['entry']:.1f}x. When someone moves from another kind of employer, the app counts outside years at 75% for a similar job and 40% for a different job. This is an assumption, and the app shows it.",
        "",
        "## 1. Fresh-graduate pay by employer",
        "",
        f"![Entry pay by employer](charts/{charts[2]})",
        "",
        "| Employer group | Examples | Job | P25 | Median | P75 | Confidence |",
        "|---|---|---|---:|---:|---:|---|",
    ]
    for r in mk["entry_by_group"]:
        lines.append(f"| {r['label']} | {', '.join(r['examples'])} | {r['function_short']} | {r['entry_p25']:,.0f} | {r['entry_p50']:,.0f} | {r['entry_p75']:,.0f} | {r['confidence']} |")
    for x in a["govt_entry"]:
        lines.append(f"| {x['label']} | National Pay Scale 2026 | Grade {x['grade']} | | {x['monthly']:,} | | official |")
    lines += [
        "",
        "UN National Officer pay (about Tk 2-3 lakh a month) comes from a single third-party transcription of the UN scale. It's shown in the app but kept out of the chart.",
        "",
        "## 2. Pay by job function",
        "",
        f"![Mid-level pay by function](charts/{charts[3]})",
        "",
        "| Job | Entry median | Mid P25 | Mid median | Mid P75 | Senior median | Best-paying employer group (mid median) |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    for r in mk["functions"]:
        lines.append(f"| {r['title']} | {r['entry_p50']:,.0f} | {r['mid_p25']:,.0f} | {r['mid_p50']:,.0f} | {r['mid_p75']:,.0f} | {r['senior_p50']:,.0f} | {r['best_group_label']}: {r['best_mid_p50']:,.0f} |")
    lines += [
        "",
        "Figures are for Dhaka, at a large local company (NGO roles at an NGO). Best-paying groups count only combinations with medium or high confidence.",
        "",
        "## 3. Government pay scale 2026",
        "",
        f"![Real change in starting basic by grade](charts/{charts[0]})",
        "",
        "| Grade | 2015 start | 2026 start | Nominal | Real (after inflation) | Jul-Dec 2026 basic | Jan-Jun 2027 basic |",
        "|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in ps["grades"]:
        lines.append(f"| {r['grade']} | {r['start_2015']:,} | {r['start_2026']:,} | +{pct(r['nominal_increase'])} | {pct(r['real_change'], 1)} | {r['phase_basic']['p1']:,} | {r['phase_basic']['p2']:,} |")
    lines += [
        "",
        f"Method: the real change divides the nominal ratio by cumulative CPI ({infl['factor_jul2015_to_jun2026']:.3f}), which is the product of BBS 12-month average inflation for FY2015-16 to FY2025-26.",
        "",
        "## 4. Income tax on salary (Finance Act 2026)",
        "",
        f"![Effective tax rate](charts/{charts[1]})",
        "",
        "| Monthly gross | Annual tax | Effective rate | Marginal rate | Monthly take-home | Invest for full rebate | Tax with full rebate |",
        "|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for m in (40000, 50000, 60000, 80000, 100000, 150000, 200000, 300000, 500000):
        c = curve[m]
        lines.append(f"| {m:,} | {c['annual_tax']:,} | {pct(c['effective_rate'], 1)} | {pct(c['marginal_rate'])} | {c['monthly_take_home']:,} | {c['investment_for_max_rebate']:,} | {c['annual_tax_with_max_rebate']:,} |")
    lines += [
        "",
        "Rules used: threshold Tk 4,00,000 (women/65+ Tk 4.5 lakh, disabled/third gender Tk 5.25 lakh, war-wounded freedom fighters/July warriors Tk 5.5 lakh); slabs of 10/15/20/25/30%; salary exemption of one-third of salary, capped at Tk 5 lakh; rebate equal to the lowest of 3% of taxable income, 10% of eligible investment and Tk 7.5 lakh; minimum tax Tk 5,000. Sources and confidence notes are in `pipeline/data/tax_rules.json`.",
        "",
        "## 5. How good is the model?",
        "",
        f"- Fitted to **{mk['n_anchors']} salary figures from {mk['n_sources']} sources**: bank MTO circulars, the minimum-wage gazette, Glassdoor and Levels.fyi figures, and recruiter and salary guides. The full list is in `pipeline/data/anchors.csv`.",
        f"- **Leave-one-out test:** each figure is dropped and predicted from the rest. The median absolute error is **{val['median_abs_pct_error']}%** (mean {val['mean_abs_pct_error']}%) over {val['n_evaluated']} figures. A baseline that uses only the prior assumptions scores {val['baseline_median_abs_pct_error']}%. Those priors already encode general knowledge of the market, such as \"multinationals pay more than SMEs\", so the gap is modest. The data's main contribution is pinning down the actual levels.",
        "- Median error by source type: " + ", ".join(f"{k} {v}%" for k, v in val["by_source_type"].items()) + ". Job circulars are reproduced closely; single secondary sources are the noisiest.",
        "- Each employer-job combination carries a confidence label. A combination with no direct figure (for example HR at a foreign bank) borrows the employer's general pay level, so the range shown is wider.",
        "",
        "## 6. Limitations",
        "",
        "- No public, crawlable dataset of Bangladeshi salaries exists, and Bdjobs.com's robots.txt disallows crawlers, so Bdjobs was not scraped. With a licensed job-post feed, `pipeline/ingest.py` can turn posts into more anchors.",
        "- Several big employers (Unilever, BAT, Grameenphone, bKash, BRAC Bank, EBL) don't publish salaries. Their figures are crowd-reported (Glassdoor, Levels.fyi) or come from career blogs, with small samples.",
        "- City adjustments outside Dhaka are assumptions. Pharma medical promotion officers are not covered.",
        "- Tax rules come from post-Act guides and the Finance Bill summary. Check them against the Finance Act 2026 gazette before filing.",
        "",
        "## Sources",
        "",
    ]
    seen = set()
    for row in a["_anchor_table"]:
        key = (row["source_name"], row["source_url"])
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"- {row['source_name']}" + (f": <{row['source_url']}>" if row["source_url"] else ""))
    for s in a["_extra_sources"]:
        lines.append(f"- {s['name']}: <{s['url']}>")
    lines += ["", "---", "", "_BD Salary Compass. Designed and developed by Atiqul Islam Chowdhury._"]
    return "\n".join(lines) + "\n"
