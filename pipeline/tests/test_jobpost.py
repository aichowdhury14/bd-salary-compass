import json

import pytest

from salary_compass import DATA_DIR
from salary_compass.jobpost import parse, match_function, level_for_years, detect_group
from salary_compass.model import load_taxonomy

VECTORS = json.loads((DATA_DIR / "jobpost_test_vectors.json").read_text(encoding="utf-8"))
TAX = load_taxonomy()


@pytest.mark.parametrize("case", VECTORS, ids=[v["text"].splitlines()[0] for v in VECTORS])
def test_parse_vectors(case):
    exp = dict(case["expected"])
    function = exp.pop("function")
    assert parse(case["text"], TAX).to_dict() == exp
    assert match_function(case["text"], TAX["functions"])[0] == function


def test_company_names_win_over_generic_words():
    assert detect_group("Join BRAC Bank PLC", TAX) == "large_bank"
    assert detect_group("BRAC is hiring field staff", TAX) == "ngo"
    assert detect_group("A leading commercial bank", TAX) == "other_bank"
    assert detect_group("Our facility in Gazipur", TAX) is None        # 'aci' inside a word must not match


def test_level_for_years():
    assert [level_for_years(y) for y in (0, 2, 4, 7, 12)] == ["entry", "junior", "mid", "senior", "lead"]
    assert level_for_years(None) is None
