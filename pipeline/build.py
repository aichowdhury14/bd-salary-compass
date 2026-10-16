"""Build every data artefact: model fit, web JSON, test vectors, charts and the analysis report.

    python build.py
"""

from __future__ import annotations

import json
import shutil
import sys

from salary_compass import DATA_DIR, REPORTS_DIR, WEB_DATA_DIR
from salary_compass.analysis import run_all
from salary_compass.charts import all_charts
from salary_compass.model import export_anchor_table, export_companies
from salary_compass.report import render
from salary_compass.tax import TaxInput, compute_tax, load_rules, CATEGORIES


def write_json(path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(REPORTS_DIR.parent)}")


def tax_vectors() -> list[dict]:
    rules = load_rules()
    cases = []
    for annual in (0, 300_000, 600_000, 610_000, 720_000, 1_200_000, 2_400_000, 3_000_000, 6_000_000, 40_000_000):
        for cat in CATEGORIES:
            for inv in (0, 50_000, 500_000):
                for parent in (False, True):
                    for new in (False, True):
                        inp = TaxInput(annual, cat, parent, inv, new)
                        r = compute_tax(inp, rules)
                        cases.append({"input": {"annualSalary": annual, "category": cat, "parentOfDisabled": parent,
                                                "eligibleInvestment": inv, "newTaxpayer": new},
                                      "expected": {"exemption": r.exemption, "taxableIncome": r.taxable_income,
                                                   "grossTax": r.gross_tax, "rebate": r.rebate, "netTax": r.net_tax,
                                                   "minimumTaxApplied": r.minimum_tax_applied}})
    return cases


def main() -> int:
    print("Fitting model and running analysis...")
    a = run_all()
    fit, bench = a.pop("_fit"), a.pop("_bench")
    anchors = export_anchor_table(fit)

    print("Writing web data...")
    write_json(WEB_DATA_DIR / "benchmarks.json", bench)
    write_json(WEB_DATA_DIR / "anchors.json", anchors)
    write_json(WEB_DATA_DIR / "companies.json", export_companies(fit.anchors))
    write_json(WEB_DATA_DIR / "insights.json", a)
    for name in ("tax_rules.json", "pay_scale_2026.json", "cpi.json", "jobpost_test_vectors.json"):
        shutil.copyfile(DATA_DIR / name, WEB_DATA_DIR / name)
        print(f"  copied {name}")
    write_json(WEB_DATA_DIR / "tax_test_vectors.json", tax_vectors())

    print("Rendering charts and report...")
    charts = all_charts(a, REPORTS_DIR / "charts")
    scale = json.loads((DATA_DIR / "pay_scale_2026.json").read_text(encoding="utf-8"))
    cpi = json.loads((DATA_DIR / "cpi.json").read_text(encoding="utf-8"))
    rules = load_rules()
    a["_anchor_table"] = anchors
    a["_extra_sources"] = scale["sources"] + cpi["sources"] + rules["sources"]
    (REPORTS_DIR / "market-analysis.md").write_text(render(a, charts), encoding="utf-8")
    print("  wrote reports/market-analysis.md")
    v = a["validation"]
    print(f"Done. LOO median abs error {v['median_abs_pct_error']}% (baseline {v['baseline_median_abs_pct_error']}%).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
