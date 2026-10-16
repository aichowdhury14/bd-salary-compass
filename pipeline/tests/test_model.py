import math

from salary_compass.model import fit, export_benchmarks, export_companies, load_anchors, percentile, LEVELS


def test_anchors_load_and_are_cited():
    anchors = load_anchors()
    assert len(anchors) >= 60
    for a in anchors:
        assert a.source_name, a.id
        assert abs(sum(a.level.values()) - 1) < 1e-9
        assert abs(sum(a.group.values()) - 1) < 1e-9


def test_pay_rises_with_experience_everywhere():
    bench = export_benchmarks(fit())
    for fid, fn in bench["functions"].items():
        for gid, cell in fn["cells"].items():
            meds = [cell["levels"][lvl]["mu"] for lvl in LEVELS]
            assert meds == sorted(meds), (fid, gid)


def test_reproduces_official_minimum_wage():
    bench = export_benchmarks(fit())
    mu = bench["functions"]["factory_worker"]["cells"]["rmg"]["levels"]["entry"]["mu"]
    assert abs(math.exp(mu) - 12_500) / 12_500 < 0.05


def test_mnc_and_bank_trainees_out_earn_local_companies():
    officer = export_benchmarks(fit())["functions"]["officer"]["cells"]
    entry = {g: math.exp(c["levels"]["entry"]["mu"]) for g, c in officer.items()}
    assert entry["mnc_fmcg"] > entry["local_conglomerate"] * 1.8
    assert entry["large_bank"] > entry["other_bank"] > entry["local_conglomerate"]
    assert entry["sme"] < entry["local_conglomerate"]


def test_every_cell_has_uncertainty_and_confidence():
    bench = export_benchmarks(fit())
    for fn in bench["functions"].values():
        for cell in fn["cells"].values():
            assert cell["confidence"] in ("high", "medium", "low")
            assert all(cell["levels"][l]["se"] > 0 for l in LEVELS)
            assert all(cell["levels"][l]["confidence"] in ("high", "medium", "low") for l in LEVELS)


def test_confidence_is_level_specific():
    bank = export_benchmarks(fit())["functions"]["officer"]["cells"]["large_bank"]["levels"]
    assert bank["entry"]["confidence"] == "high"          # many MTO circulars
    assert bank["mid"]["confidence"] == "medium"          # only one small-sample figure at 3-5 years


def test_bank_pay_rises_slower_than_mnc_fast_track():
    cells = export_benchmarks(fit())["functions"]["officer"]["cells"]
    growth = lambda g: math.exp(cells[g]["levels"]["senior"]["mu"] - cells[g]["levels"]["entry"]["mu"])
    assert growth("large_bank") < 2.2 < growth("mnc_fmcg")
    senior_bank = math.exp(cells["large_bank"]["levels"]["senior"]["mu"])
    assert 100_000 < senior_bank < 170_000                # SPO / AVP figures: 70k-150k


def test_company_figures_link_to_anchors():
    companies = export_companies(load_anchors())
    names = {c["name"] for c in companies}
    assert {"Unilever Bangladesh", "The City Bank", "bKash", "Grameenphone"} <= names
    assert all(c["figures"] for c in companies)


def test_percentile_median_is_50():
    assert abs(percentile(math.exp(10.5), 10.5, 0.3) - 50) < 1e-9
