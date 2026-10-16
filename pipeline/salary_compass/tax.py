"""Bangladesh personal income tax on salary income.

Mirrors web/src/lib/tax.ts. Both read pipeline/data/tax_rules.json and are checked
against the same test vectors (data/tax_test_vectors.json), so the analysis report
and the web calculator always agree.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field, asdict

from . import DATA_DIR

CATEGORIES = ("general", "woman_or_senior", "disabled", "third_gender", "freedom_fighter")


def half_up(x: float) -> int:
    """Round half away from zero for positives, matching JavaScript Math.round."""
    return math.floor(x + 0.5)


def load_rules() -> dict:
    return json.loads((DATA_DIR / "tax_rules.json").read_text(encoding="utf-8"))


@dataclass
class TaxInput:
    annual_salary: float                 # all cash salary + bonuses for the income year
    category: str = "general"
    parent_of_disabled: bool = False
    eligible_investment: float = 0.0     # DPS, savings certificates, PF contribution, listed shares...
    new_taxpayer: bool = False


@dataclass
class SlabLine:
    rate: float
    amount: float
    tax: float


@dataclass
class TaxResult:
    gross: float
    exemption: float
    taxable_income: float
    threshold: float
    slab_lines: list[SlabLine] = field(default_factory=list)
    gross_tax: float = 0.0
    rebate: float = 0.0
    max_rebate: float = 0.0
    investment_for_max_rebate: float = 0.0
    minimum_tax_applied: bool = False
    net_tax: float = 0.0
    effective_rate: float = 0.0
    marginal_rate: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


def compute_tax(inp: TaxInput, rules: dict | None = None) -> TaxResult:
    rules = rules or load_rules()
    if inp.category not in CATEGORIES:
        raise ValueError(f"unknown category {inp.category!r}")

    gross = max(0.0, float(inp.annual_salary))
    ex = rules["employment_exemption"]
    exemption = min(gross * ex["fraction"], ex["cap"])
    taxable = gross - exemption

    threshold = rules["thresholds"][inp.category]
    if inp.parent_of_disabled:
        threshold += rules["parent_of_disabled_extra"]

    lines: list[SlabLine] = []
    remaining = max(0.0, taxable - threshold)
    marginal = 0.0
    for slab in rules["slabs"]:
        if remaining <= 0:
            break
        width = slab["width"] if slab["width"] is not None else remaining
        amount = min(remaining, width)
        lines.append(SlabLine(rate=slab["rate"], amount=amount, tax=amount * slab["rate"]))
        marginal = slab["rate"]
        remaining -= amount
    gross_tax = sum(l.tax for l in lines)

    rb = rules["rebate"]
    max_rebate = min(taxable * rb["income_rate"], rb["cap"])
    rebate = min(max_rebate, max(0.0, inp.eligible_investment) * rb["investment_rate"], gross_tax)
    net = gross_tax - rebate

    min_applied = False
    if taxable > threshold:
        floor = rules["minimum_tax"]["new_taxpayer" if inp.new_taxpayer else "regular"]
        if net < floor:
            net = floor
            min_applied = True

    net = half_up(net)
    return TaxResult(
        gross=gross,
        exemption=half_up(exemption),
        taxable_income=half_up(taxable),
        threshold=threshold,
        slab_lines=lines,
        gross_tax=half_up(gross_tax),
        rebate=half_up(rebate),
        max_rebate=half_up(min(max_rebate, gross_tax)),
        investment_for_max_rebate=half_up(min(max_rebate, gross_tax) / rb["investment_rate"]),
        minimum_tax_applied=min_applied,
        net_tax=net,
        effective_rate=(net / gross) if gross else 0.0,
        marginal_rate=marginal,
    )


def tax_free_monthly_salary(category: str = "general", rules: dict | None = None) -> float:
    """Largest monthly gross salary (12 months, no bonus) with zero tax."""
    rules = rules or load_rules()
    ex = rules["employment_exemption"]
    threshold = rules["thresholds"][category]
    # taxable = gross - min(gross/3, cap) <= threshold
    by_fraction = threshold / (1 - ex["fraction"])
    annual = by_fraction if by_fraction * ex["fraction"] <= ex["cap"] else threshold + ex["cap"]
    return annual / 12
