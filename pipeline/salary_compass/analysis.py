"""Bangladesh job-market analysis: pay scale vs inflation, tax burden, private-sector benchmarks."""

from __future__ import annotations

import json
import math
import statistics

from . import DATA_DIR
from .model import FitResult, export_benchmarks, fit, load_anchors, load_taxonomy
from .tax import TaxInput, compute_tax, load_rules, tax_free_monthly_salary, CATEGORIES


def _load(name: str) -> dict:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- inflation
def cumulative_inflation(cpi: dict, from_fy: str, to_fy: str) -> float:
    years = [y["fy"] for y in cpi["fiscal_year_average"]]
    i, j = years.index(from_fy), years.index(to_fy)
    factor = 1.0
    for y in cpi["fiscal_year_average"][i: j + 1]:
        factor *= 1 + y["rate"]
    return factor


def inflation_analysis(cpi: dict) -> dict:
    since_2015 = cumulative_inflation(cpi, "FY2015-16", "FY2025-26")
    since_2022 = cumulative_inflation(cpi, "FY2022-23", "FY2025-26")
    return {
        "factor_jul2015_to_jun2026": round(since_2015, 4),
        "factor_jul2022_to_jun2026": round(since_2022, 4),
        "purchasing_power_lost_if_frozen_since_2022": round(1 - 1 / since_2022, 4),
        "latest_point_to_point": cpi["latest_point_to_point"],
        "fy_series": cpi["fiscal_year_average"],
    }


# ---------------------------------------------------------------- government pay scale
def basic_in_phase(grade: dict, phase: dict) -> float:
    share = phase["share_grade_1_9"] if grade["grade"] <= 9 else phase["share_grade_10_20"]
    return grade["start_2015"] + share * (grade["start_2026"] - grade["start_2015"])


def house_rent_rate(scale: dict, grade: int, location: str) -> float:
    for band in scale["house_rent"]["bands"]:
        lo, hi = band["grades"]
        if lo <= grade <= hi:
            return band[location]
    raise ValueError(grade)


def govt_monthly_package(scale: dict, grade_no: int, location: str = "dhaka", age_over_50: bool = False) -> dict:
    """Full-implementation package (new basic from Jul 2027, new allowances from Jan 2028)."""
    grade = next(g for g in scale["grades"] if g["grade"] == grade_no)
    basic = grade["start_2026"]
    hr = basic * house_rent_rate(scale, grade_no, location)
    medical = scale["medical"]["above_50" if age_over_50 else "up_to_50"]
    monthly = basic + hr + medical
    annual_extras = basic * scale["festival_bonus_per_year_in_basics"] + basic * scale["boishakhi_rate"]
    return {"grade": grade_no, "basic": basic, "house_rent": round(hr), "medical": medical,
            "monthly_gross": round(monthly), "annual_extras": round(annual_extras),
            "monthly_equivalent": round(monthly + annual_extras / 12)}


def payscale_analysis(scale: dict, cpi_factor: float) -> dict:
    rows = []
    for g in scale["grades"]:
        nominal = g["start_2026"] / g["start_2015"] - 1
        real = g["start_2026"] / g["start_2015"] / cpi_factor - 1
        phases = {p["id"]: round(basic_in_phase(g, p)) for p in scale["phases"]}
        rows.append({"grade": g["grade"], "start_2015": g["start_2015"], "start_2026": g["start_2026"],
                     "nominal_increase": round(nominal, 4), "real_change": round(real, 4),
                     "phase_basic": phases})
    ratio_2015 = scale["grades"][0]["start_2015"] / scale["grades"][-1]["start_2015"]
    ratio_2026 = scale["grades"][0]["start_2026"] / scale["grades"][-1]["start_2026"]
    return {"grades": rows, "top_bottom_ratio_2015": round(ratio_2015, 2),
            "top_bottom_ratio_2026": round(ratio_2026, 2)}


# ---------------------------------------------------------------- tax
def tax_analysis(rules: dict) -> dict:
    curve = []
    for monthly in list(range(20_000, 100_000, 5_000)) + list(range(100_000, 525_000, 25_000)):
        annual = monthly * 12
        r = compute_tax(TaxInput(annual_salary=annual), rules)
        r_inv = compute_tax(TaxInput(annual_salary=annual, eligible_investment=r.investment_for_max_rebate), rules)
        curve.append({
            "monthly_gross": monthly,
            "annual_tax": r.net_tax,
            "effective_rate": round(r.effective_rate, 4),
            "marginal_rate": r.marginal_rate,
            "monthly_take_home": round(monthly - r.net_tax / 12),
            "annual_tax_with_max_rebate": r_inv.net_tax,
            "investment_for_max_rebate": r.investment_for_max_rebate,
        })
    tax_free = {c: round(tax_free_monthly_salary(c, rules)) for c in CATEGORIES}
    return {"curve": curve, "tax_free_monthly_salary": tax_free, "rules_label": rules["label"]}


# ---------------------------------------------------------------- model validation
def _predict(res: FitResult, a, taxonomy: dict) -> float:
    mu = 0.0
    for lvl, w in a.level.items():
        for g, v in a.group.items():
            mu += w * v * res.cell(a.function, lvl, g)[0]
    city = next(c for c in taxonomy["cities"] if c["id"] == a.city)
    return mu + math.log(city["multiplier"])


def leave_one_out(taxonomy: dict) -> dict:
    """Drop each anchor, refit, predict it. Anchors whose function has no other anchor are skipped."""
    anchors = load_anchors(taxonomy)
    errors, by_type = [], {}
    for k, a in enumerate(anchors):
        others = anchors[:k] + anchors[k + 1:]
        if not any(o.function == a.function for o in others):
            continue
        res = fit(taxonomy, others)
        err = abs(math.exp(_predict(res, a, taxonomy) - a.log_median) - 1)
        errors.append(err)
        by_type.setdefault(a.source_type, []).append(err)

    # Baseline: priors only, no data.
    pri = taxonomy["priors"]
    gp = {g["id"]: g["prior"] for g in taxonomy["groups"]}
    base_err = []
    for a in anchors:
        mu = math.log(pri["function_base_prior"])
        mu += sum(w * math.log(pri["level_multiplier"][l]) for l, w in a.level.items())
        mu += sum(v * math.log(gp[g]) for g, v in a.group.items())
        base_err.append(abs(math.exp(mu - a.log_median) - 1))
    return {
        "n_evaluated": len(errors),
        "median_abs_pct_error": round(statistics.median(errors) * 100, 1),
        "mean_abs_pct_error": round(statistics.mean(errors) * 100, 1),
        "baseline_median_abs_pct_error": round(statistics.median(base_err) * 100, 1),
        "by_source_type": {k: round(statistics.median(v) * 100, 1) for k, v in sorted(by_type.items())},
    }


# ---------------------------------------------------------------- private market
def _q(fn: dict, group: str, level: str, z: float = 0.0) -> float:
    cell = fn["cells"][group]["levels"][level]
    s = math.sqrt(fn["sigma"] ** 2 + cell["se"] ** 2 + cell["extra_sd"] ** 2)
    return round(math.exp(cell["mu"] + z * s), -2)


def market_analysis(result: FitResult, bench: dict) -> dict:
    ref = result.taxonomy["reference_group"]
    labels = {g["id"]: g["label"] for g in bench["groups"]}
    functions = []
    for fid, fn in bench["functions"].items():
        home = ref if ref in fn["cells"] else next(iter(fn["cells"]))
        trusted = [g for g in fn["cells"] if fn["cells"][g]["levels"]["mid"]["confidence"] != "low"] or [home]
        best = max(trusted, key=lambda g: fn["cells"][g]["levels"]["mid"]["mu"])
        functions.append({
            "function": fid, "title": fn["title"], "short": fn["short"],
            "group": home, "group_label": labels[home], "confidence": fn["cells"][home]["levels"]["mid"]["confidence"],
            "entry_p50": _q(fn, home, "entry"), "mid_p25": _q(fn, home, "mid", -0.6745),
            "mid_p50": _q(fn, home, "mid"), "mid_p75": _q(fn, home, "mid", 0.6745), "senior_p50": _q(fn, home, "senior"),
            "best_group": best, "best_group_label": labels[best], "best_mid_p50": _q(fn, best, "mid"),
            "best_confidence": fn["cells"][best]["levels"]["mid"]["confidence"],
        })
    functions.sort(key=lambda r: r["mid_p50"], reverse=True)

    # Graduate entry pay by employer group: trainee/officer track (programme officer for NGOs/UN).
    entry_by_group = []
    for g in bench["groups"]:
        main_job = {"private_university": "teaching", "ngo": "program_officer", "un_agency": "program_officer"}
        fid = main_job.get(g["id"]) or ("officer" if "officer" in g["functions"] else "software")
        fn = bench["functions"][fid]
        if g["id"] not in fn["cells"]:
            continue
        entry_by_group.append({"group": g["id"], "label": g["label"], "function": fid, "function_short": fn["short"],
                               "examples": g["companies"][:3], "entry_p50": _q(fn, g["id"], "entry"),
                               "entry_p25": _q(fn, g["id"], "entry", -0.6745), "entry_p75": _q(fn, g["id"], "entry", 0.6745),
                               "confidence": fn["cells"][g["id"]]["levels"]["entry"]["confidence"]})
    entry_by_group.sort(key=lambda r: r["entry_p50"], reverse=True)
    officer = bench["functions"]["officer"]
    curves = {g: {lvl: _q(officer, g, lvl) for lvl in ("entry", "junior", "mid", "senior", "lead")}
              for g in ("large_bank", "mnc_fmcg", "local_conglomerate")}
    return {
        "officer_curves": curves,
        "functions": functions,
        "entry_by_group": entry_by_group,
        "level_multipliers": bench["level_multipliers"],
        "group_multipliers": {g["id"]: g["multiplier"] for g in bench["groups"]},
        "reference_group": ref,
        "n_anchors": len(result.anchors),
        "n_sources": len({a.source_name for a in result.anchors}),
    }


def govt_entry(scale: dict) -> list[dict]:
    out = []
    for grade, who in ((9, "BCS cadre entry"), (10, "Sub-Asst Engineer, Sr Staff Nurse")):
        pkg = govt_monthly_package(scale, grade)
        out.append({"grade": grade, "label": f"Government Grade {grade} ({who})", "monthly": round(pkg["monthly_equivalent"], -2),
                    "phase1_basic": round(basic_in_phase(scale["grades"][grade - 1], scale["phases"][0])),
                    "note": f"Full 2026 scale in Dhaka: basic {pkg['basic']:,} + house rent {pkg['house_rent']:,} + medical {pkg['medical']:,}, with 2 festival bonuses and Boishakhi spread over 12 months."})
    return out


def run_all() -> dict:
    taxonomy = load_taxonomy()
    rules, scale, cpi = load_rules(), _load("pay_scale_2026.json"), _load("cpi.json")
    result = fit(taxonomy)
    bench = export_benchmarks(result)
    infl = inflation_analysis(cpi)
    return {
        "inflation": infl,
        "payscale": payscale_analysis(scale, infl["factor_jul2015_to_jun2026"]),
        "tax": tax_analysis(rules),
        "market": market_analysis(result, bench),
        "govt_entry": govt_entry(scale),
        "validation": leave_one_out(taxonomy),
        "_fit": result,
        "_bench": bench,
    }
