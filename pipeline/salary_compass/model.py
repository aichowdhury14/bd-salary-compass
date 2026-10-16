"""Salary benchmark model.

Monthly gross salary is modelled as log-normal:

    ln(salary) = base[function] + level_effect[level] + group_effect[employer group] + ln(city) + e
    e ~ Normal(0, sigma)

"Function" is the kind of job (finance, software, sales...). "Group" is the kind of employer
(multinational FMCG such as Unilever or BAT, large private banks, top software companies...).

Bangladesh has no open, crawlable salary dataset, so the parameters are fitted to cited
"anchors": job circulars, the minimum-wage gazette, Glassdoor/Levels.fyi figures and recruiter
guides. Each anchor is a median (or a range whose geometric mean is taken as the median) for a
function at a level and employer group. Anchors that mix levels or groups enter as weighted
averages of the effects. The fit is weighted ridge regression with Gaussian priors; its posterior
covariance gives each cell's standard error, which widens the range shown to users.
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass

import numpy as np

from . import DATA_DIR

LEVELS = ["entry", "junior", "mid", "senior", "lead"]
FREE_LEVELS = LEVELS[1:]                   # entry is the reference level
LEVEL_INDEX = {lvl: i for i, lvl in enumerate(LEVELS)}
SOURCE_QUALITY = {"official": 1.0, "job_circular": 0.95, "news": 0.85, "aggregator": 0.8, "recruiter": 0.7,
                  "job_post": 0.7, "blog": 0.6, "news_secondary": 0.5}
OBS_SD = 0.18                               # how much independent anchors disagree, in log terms
MIN_STEP = math.log(1.04)                   # each experience level pays at least 4% more than the last
FLOOR = math.log(11_000)                    # lowest published formal-sector monthly pay (Paylab customer support ~11k)


def load_taxonomy() -> dict:
    return json.loads((DATA_DIR / "taxonomy.json").read_text(encoding="utf-8"))


def group_ids(taxonomy: dict) -> list[str]:
    return [g["id"] for g in taxonomy["groups"]]


def function_ids(taxonomy: dict) -> list[str]:
    return [f["id"] for f in taxonomy["functions"]]


@dataclass
class Anchor:
    id: str
    function: str
    level: dict[str, float]
    group: dict[str, float]
    city: str
    low: float
    high: float
    median: float
    range_type: str
    source_type: str
    weight: float
    source_name: str
    source_url: str
    published: str
    note: str

    @property
    def log_median(self) -> float:
        return math.log(self.median)


def _parse_mix(text: str, default: dict[str, float] | None, allowed: list[str]) -> dict[str, float]:
    text = text.strip()
    if text == "mix":
        if default is None:
            raise ValueError("'mix' is not allowed here; list the weights explicitly")
        mix = dict(default)
    elif "|" in text or ":" in text:
        mix = {}
        for part in text.split("|"):
            key, val = part.split(":")
            mix[key.strip()] = float(val)
    else:
        mix = {text: 1.0}
    unknown = set(mix) - set(allowed)
    if unknown:
        raise ValueError(f"unknown keys {unknown} in {text!r}")
    total = sum(mix.values())
    return {k: v / total for k, v in mix.items()}


def load_anchors(taxonomy: dict | None = None) -> list[Anchor]:
    taxonomy = taxonomy or load_taxonomy()
    functions, groups = function_ids(taxonomy), group_ids(taxonomy)
    files = [DATA_DIR / "anchors.csv"]
    if (DATA_DIR / "anchors_jobposts.csv").exists():      # written by ingest.py
        files.append(DATA_DIR / "anchors_jobposts.csv")
    rows = []
    for path in files:
        with open(path, encoding="utf-8", newline="") as f:
            rows.extend(csv.DictReader(f))

    anchors = []
    for row in rows:
        if row["function"] not in functions:
            raise ValueError(f"anchor {row['id']}: unknown function {row['function']}")
        low, high = float(row["low"]), float(row["high"])
        if low <= 0 or high < low:
            raise ValueError(f"anchor {row['id']}: bad range {low}-{high}")
        median = float(row["median"]) if row["median"] else math.sqrt(low * high)
        anchors.append(Anchor(
            id=row["id"], function=row["function"],
            level=_parse_mix(row["level"], taxonomy["mix_level"], LEVELS),
            group=_parse_mix(row["group"], None, groups),
            city=row["city"], low=low, high=high, median=median,
            range_type=row["range_type"], source_type=row["source_type"],
            weight=float(row["weight"]), source_name=row["source_name"],
            source_url=row["source_url"], published=row["published"], note=row["note"],
        ))
    return anchors


class Layout:
    """Parameter vector:
    [base per function..., shared level effects..., group effects..., group experience slopes...]

    The group slope lets an employer type's pay rise faster or slower with experience than the
    shared curve (bank officer ladders, for example, are much flatter than MNC fast tracks).
    The reference group has no free level or slope parameters (it carries the shared curve).
    """

    def __init__(self, taxonomy: dict):
        self.functions = function_ids(taxonomy)
        self.reference = taxonomy["reference_group"]
        self.free_groups = [g for g in group_ids(taxonomy) if g != self.reference]
        self._slope0 = len(self.functions) + len(FREE_LEVELS) + len(self.free_groups)
        self.n = self._slope0 + len(self.free_groups)
        self.overrides = {f["id"]: f.get("level_multiplier_override") for f in taxonomy["functions"]}

    def fn(self, f: str) -> int:
        return self.functions.index(f)

    def level(self, lvl: str) -> int | None:
        return None if lvl == "entry" else len(self.functions) + FREE_LEVELS.index(lvl)

    def group(self, g: str) -> int | None:
        return None if g == self.reference else len(self.functions) + len(FREE_LEVELS) + self.free_groups.index(g)

    def slope(self, g: str) -> int | None:
        return None if g == self.reference else self._slope0 + self.free_groups.index(g)

    def row(self, function: str, levels: dict[str, float], groups: dict[str, float]) -> tuple[np.ndarray, float]:
        """Design row plus fixed offset (from role-specific level curves)."""
        x = np.zeros(self.n)
        x[self.fn(function)] = 1.0
        offset = 0.0
        override = self.overrides.get(function)
        for lvl, w in levels.items():
            if override:
                offset += w * math.log(override[lvl])
            elif (i := self.level(lvl)) is not None:
                x[i] += w
        level_idx = sum(w * LEVEL_INDEX[lvl] for lvl, w in levels.items())
        for g, w in groups.items():
            if (j := self.group(g)) is not None:
                x[j] += w
                if not override:
                    x[self.slope(g)] += w * level_idx
        return x, offset


@dataclass
class FitResult:
    layout: Layout
    theta: np.ndarray
    cov: np.ndarray
    residual_sd: float
    anchors: list[Anchor]
    residuals: list[float]
    taxonomy: dict

    def level_effect(self, level: str) -> float:
        i = self.layout.level(level)
        return 0.0 if i is None else float(self.theta[i])

    def group_effect(self, group: str) -> float:
        i = self.layout.group(group)
        return 0.0 if i is None else float(self.theta[i])

    def group_slope(self, group: str) -> float:
        i = self.layout.slope(group)
        return 0.0 if i is None else float(self.theta[i])

    def cell(self, function: str, level: str, group: str) -> tuple[float, float]:
        """Log-median and its standard error for a Dhaka cell."""
        x, offset = self.layout.row(function, {level: 1.0}, {group: 1.0})
        mu = float(x @ self.theta) + offset
        se = float(math.sqrt(max(0.0, x @ self.cov @ x)))
        return mu, se


def fit(taxonomy: dict | None = None, anchors: list[Anchor] | None = None) -> FitResult:
    taxonomy = taxonomy or load_taxonomy()
    anchors = anchors if anchors is not None else load_anchors(taxonomy)
    layout = Layout(taxonomy)
    pri = taxonomy["priors"]
    cities = {c["id"]: c["multiplier"] for c in taxonomy["cities"]}

    rows, ys, ws = [], [], []
    for a in anchors:
        x, offset = layout.row(a.function, a.level, a.group)
        rows.append(x)
        ys.append(a.log_median - offset - math.log(cities[a.city]))
        ws.append(a.weight * SOURCE_QUALITY.get(a.source_type, 0.5))
    X, y, W = np.array(rows), np.array(ys), np.array(ws)

    # Gaussian priors as pseudo-observations (ridge towards the prior means).
    prior_mean, prior_prec = np.zeros(layout.n), np.zeros(layout.n)
    for f in layout.functions:
        prior_mean[layout.fn(f)] = math.log(pri["function_base_prior"])
        prior_prec[layout.fn(f)] = 1.0 / pri["function_base_prior_sd"] ** 2
    for lvl in FREE_LEVELS:
        prior_mean[layout.level(lvl)] = math.log(pri["level_multiplier"][lvl])
        prior_prec[layout.level(lvl)] = 1.0 / pri["level_prior_sd"] ** 2
    for g in taxonomy["groups"]:
        if (j := layout.group(g["id"])) is not None:
            prior_mean[j] = math.log(g["prior"])
            prior_prec[j] = 1.0 / pri["group_prior_sd"] ** 2
            prior_prec[layout.slope(g["id"])] = 1.0 / pri["group_slope_prior_sd"] ** 2   # mean 0: shared curve

    obs_prec = W / OBS_SD ** 2
    A = X.T @ (obs_prec[:, None] * X) + np.diag(prior_prec)
    b = X.T @ (obs_prec * y) + prior_prec * prior_mean
    cov = np.linalg.inv(A)
    theta = cov @ b
    resid = y - X @ theta
    residual_sd = float(math.sqrt(np.sum(W * resid ** 2) / np.sum(W)))
    return FitResult(layout=layout, theta=theta, cov=cov, residual_sd=residual_sd,
                     anchors=anchors, residuals=[float(r) for r in resid], taxonomy=taxonomy)


STRONG_SOURCES = ("official", "job_circular")


def confidence_label(function: str, group: str, anchors: list[Anchor], level: str | None = None) -> str:
    """How directly the published figures support an estimate.

    high:   2+ figures for this exact job and employer group (at this experience level, if given),
            or one official figure / job circular at that level
    medium: some figure for this job and employer group (e.g. at another level), or plenty for the job elsewhere
    low:    the estimate borrows the employer group's general pay level
    """
    direct = [a for a in anchors if a.function == function and a.group.get(group, 0) >= 0.3]
    at_level = [a for a in direct if level is None or a.level.get(level, 0) >= 0.3]
    if len(at_level) >= 2 or any(a.source_type in STRONG_SOURCES for a in at_level):
        return "high"
    fn_any = [a for a in anchors if a.function == function]
    if direct or (len(fn_any) >= 3 and any(a.group.get(group, 0) > 0 for a in fn_any)):
        return "medium"
    return "low"


def export_benchmarks(result: FitResult) -> dict:
    tax = result.taxonomy
    default_sigma = tax["priors"]["cell_sigma"]
    groups = {g["id"]: g for g in tax["groups"]}
    functions = {}
    for f in tax["functions"]:
        fid = f["id"]
        cells = {}
        for gid, g in groups.items():
            if fid not in g["functions"]:
                continue
            extra = tax["priors"]["extra_sd_by_confidence"]
            levels = {}
            prev = -math.inf
            for lvl in LEVELS:
                mu, se = result.cell(fid, lvl, gid)
                mu = max(mu, prev + MIN_STEP, FLOOR)  # never falls with experience, never below the floor
                prev = mu
                conf = confidence_label(fid, gid, result.anchors, lvl)
                levels[lvl] = {"mu": round(mu, 4), "se": round(se, 4), "confidence": conf, "extra_sd": extra[conf]}
            cells[gid] = {"confidence": confidence_label(fid, gid, result.anchors), "levels": levels}
        functions[fid] = {
            "title": f["title"], "short": f["short"], "title_bn": f["title_bn"], "about": f["about"],
            "sigma": f.get("sigma", default_sigma), "keywords": f["keywords"], "skills": f["skills"],
            "adjacent": f["adjacent"], "cells": cells,
        }
    return {
        "model": "log-normal, weighted ridge fit to cited anchors",
        "levels": tax["levels"], "cities": tax["cities"], "city_note": tax["city_note"],
        "match_order": tax["match_order"],
        "sector_bound_functions": tax["sector_bound_functions"],
        "groups": [{k: g[k] for k in ("id", "label", "label_bn", "sector", "companies", "functions", "match")} | {
            "multiplier": round(math.exp(result.group_effect(g["id"])), 3),
            "experience_slope": round(math.exp(result.group_slope(g["id"])), 3)} for g in tax["groups"]],
        "experience_credit": tax["experience_credit"],
        "level_multipliers": {l: round(math.exp(result.level_effect(l)), 3) for l in LEVELS},
        "residual_sd": round(result.residual_sd, 3),
        "functions": functions,
    }


def export_anchor_table(result: FitResult) -> list[dict]:
    rows = []
    for a, r in zip(result.anchors, result.residuals):
        rows.append({
            "id": a.id, "function": a.function, "low": a.low, "high": a.high, "median": round(a.median),
            "level": a.level, "group": a.group, "range_type": a.range_type,
            "source_type": a.source_type, "source_name": a.source_name, "source_url": a.source_url,
            "published": a.published, "note": a.note,
            "model_median": round(a.median / math.exp(r)), "residual_pct": round((math.exp(r) - 1) * 100, 1),
        })
    return rows


def export_companies(anchors: list[Anchor]) -> list[dict]:
    spec = json.loads((DATA_DIR / "companies.json").read_text(encoding="utf-8"))
    by_id = {a.id: a for a in anchors}
    out = []
    for c in spec["companies"]:
        figures = []
        for aid in c["anchors"]:
            a = by_id[aid]
            level = max(a.level, key=a.level.get) if len(a.level) == 1 else "mix"
            figures.append({"function": a.function, "level": level, "low": a.low, "high": a.high,
                            "median": round(a.median), "note": a.note, "source_name": a.source_name,
                            "source_url": a.source_url, "published": a.published, "source_type": a.source_type})
        out.append({"name": c["name"], "group": c["group"], "figures": figures})
    return out


def percentile(salary: float, mu: float, sigma_total: float) -> float:
    """Share of comparable people earning less than `salary` (0-100)."""
    z = (math.log(salary) - mu) / sigma_total
    return 50.0 * (1.0 + math.erf(z / math.sqrt(2.0)))
