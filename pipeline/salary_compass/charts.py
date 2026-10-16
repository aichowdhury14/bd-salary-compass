"""Static charts for the analysis report (matplotlib). Palette follows the project's chart tokens."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, PercentFormatter

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
POS, NEG = "#2a78d6", "#e34948"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "font.family": ["Segoe UI", "DejaVu Sans", "sans-serif"], "font.size": 10,
    "axes.edgecolor": AXIS, "axes.labelcolor": INK_2, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.8, "axes.axisbelow": True,
    "axes.titlesize": 12, "axes.titleweight": "bold", "axes.titlecolor": INK,
    "axes.titlelocation": "left", "legend.frameon": False, "legend.labelcolor": INK_2,
})

taka = FuncFormatter(lambda v, _: f"৳{v/1000:,.0f}k")


def _save(fig, path: Path) -> str:
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)
    return path.name


def payscale_real_change(analysis: dict, out: Path) -> str:
    rows = analysis["payscale"]["grades"]
    grades = [str(r["grade"]) for r in rows]
    vals = [r["real_change"] for r in rows]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.bar(grades, vals, color=[POS if v >= 0 else NEG for v in vals], width=0.62)
    ax.axhline(0, color=AXIS, linewidth=1)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_xlabel("Grade (1 = highest)")
    ax.set_title("Starting basic 2026 vs 2015, after inflation")
    ax.grid(axis="x", visible=False)
    for g, v in zip(grades, vals):
        if g in ("1", "11", "12", "20"):
            ax.annotate(f"{v:+.1%}", (g, max(v, 0)), textcoords="offset points",
                        xytext=(0, 4), ha="center", color=INK_2, fontsize=9)
    return _save(fig, out / "payscale_real_change.png")


def tax_curve(analysis: dict, out: Path) -> str:
    curve = analysis["tax"]["curve"]
    x = [c["monthly_gross"] for c in curve]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.plot(x, [c["effective_rate"] for c in curve], color=SERIES[0], linewidth=2, label="No tax-saving investment")
    eff_inv = [c["annual_tax_with_max_rebate"] / (c["monthly_gross"] * 12) for c in curve]
    ax.plot(x, eff_inv, color=SERIES[1], linewidth=2, label="With investment for full rebate")
    ax.xaxis.set_major_formatter(taka)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_xlabel("Monthly gross salary")
    ax.set_title("Effective income tax rate on salary (Finance Act 2026)")
    ax.legend(loc="upper left")
    return _save(fig, out / "tax_effective_rate.png")


def entry_by_employer(analysis: dict, out: Path) -> str:
    rows = [dict(r, kind="private") for r in analysis["market"]["entry_by_group"] if r["group"] != "un_agency"]
    rows += [{"label": g["label"].replace("Government ", "Govt "), "entry_p50": g["monthly"], "entry_p25": None,
              "entry_p75": None, "confidence": "high", "kind": "govt", "function_short": ""} for g in analysis["govt_entry"]]
    rows.sort(key=lambda r: r["entry_p50"])
    fig, ax = plt.subplots(figsize=(8, 5.6))
    for i, r in enumerate(rows):
        ax.barh(i, r["entry_p50"], color=SERIES[2] if r["kind"] == "govt" else SERIES[0], height=0.58)
        if r["entry_p25"]:
            ax.plot([r["entry_p25"], r["entry_p75"]], [i, i], color=INK_2, linewidth=1.1)
        right = r["entry_p75"] or r["entry_p50"]
        tag = " (low confidence)" if r["confidence"] == "low" else ""
        ax.annotate(f"৳{r['entry_p50']/1000:,.0f}k{tag}", (right, i), textcoords="offset points", xytext=(6, -3), color=INK_2, fontsize=8.5)
    ax.set_yticks(range(len(rows)), [r["label"] for r in rows], fontsize=8.8)
    ax.xaxis.set_major_formatter(taka)
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0, max((r["entry_p75"] or r["entry_p50"]) for r in rows) * 1.22)
    fig.suptitle("Fresh-graduate pay by employer (Dhaka, monthly; government in green)", x=0.01, ha="left",
                 fontsize=12, fontweight="bold", color=INK)
    return _save(fig, out / "entry_by_employer.png")


def function_mid(analysis: dict, out: Path) -> str:
    rows = sorted(analysis["market"]["functions"], key=lambda r: r["mid_p50"])
    fig, ax = plt.subplots(figsize=(8, 5.0))
    for i, r in enumerate(rows):
        ax.barh(i, r["mid_p50"], color=SERIES[0], height=0.55)
        ax.plot([r["mid_p25"], r["mid_p75"]], [i, i], color=INK_2, linewidth=1.1)
        ax.annotate(f"৳{r['mid_p50']/1000:,.0f}k", (r["mid_p75"], i), textcoords="offset points", xytext=(6, -3), color=INK_2, fontsize=8.5)
    ax.set_yticks(range(len(rows)), [r["short"] for r in rows], fontsize=9)
    ax.xaxis.set_major_formatter(taka)
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0, max(r["mid_p75"] for r in rows) * 1.2)
    fig.suptitle("Mid-level (3-6 yrs) pay by job, at a large local company (NGO jobs: at an NGO)", x=0.01, ha="left",
                 fontsize=12, fontweight="bold", color=INK)
    return _save(fig, out / "function_mid.png")


def all_charts(analysis: dict, out: Path) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    for old in ("role_mid_medians.png", "experience_curve.png", "govt_vs_private.png"):
        (out / old).unlink(missing_ok=True)
    return [payscale_real_change(analysis, out), tax_curve(analysis, out), entry_by_employer(analysis, out),
            function_mid(analysis, out)]
