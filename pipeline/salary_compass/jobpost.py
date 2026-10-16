"""Parse Bangladeshi job posts (English / Bangla / mixed) into structured fields.

Used two ways:
  * mirrored in web/src/lib/jobpost.ts so a visitor can paste a job post and see how
    the offered salary compares with the market (runs in the browser, nothing stored);
  * here, to ingest a job-post CSV you are licensed to use (see ingest.py) into extra
    model anchors.

Both implementations are checked against data/jobpost_test_vectors.json.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, asdict

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

CITY_PATTERNS = [
    ("dhaka", r"\b(dhaka|gulshan|banani|motijheel|mirpur|uttara|dhanmondi|tejgaon|mohakhali|gazipur|narayanganj|savar|ashulia|tongi|keraniganj)\b|ঢাকা|গাজীপুর|নারায়ণগঞ্জ"),
    ("chattogram", r"\b(chattogram|chittagong|ctg)\b|চট্টগ্রাম"),
    ("other_city", r"\b(sylhet|khulna|rajshahi|barishal|barisal|rangpur|mymensingh|cumilla|comilla)\b|সিলেট|খুলনা|রাজশাহী|বরিশাল|রংপুর|ময়মনসিংহ|কুমিল্লা"),
]

_NUM = r"(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|লাখ|হাজার)?"
_CUR = r"(?:tk\.?|bdt|৳|taka|টাকা)"
_RANGE = re.compile(_NUM + r"\s*" + _CUR + r"?\s*(?:-|–|—|to|থেকে)\s*" + _CUR + r"?\s*" + _NUM, re.I)
# "Age 22-30 years", "maximum age 32 years", "বয়স ৩০ বছর": an age limit, not experience.
_AGE = re.compile(r"(?<![a-z])(?:age|বয়স)(?![a-z])[^\n\d]{0,20}\d+(?:\s*(?:-|–|to|থেকে)\s*\d+)?\s*(?:years?|yrs?|বছর)?", re.I)
_SINGLE = re.compile(r"(?:tk\.?|bdt|৳|taka|salary[^\d\n]{0,20})\s*" + _NUM, re.I)


@dataclass
class ParsedJobPost:
    salary_min: float | None
    salary_max: float | None
    salary_period: str | None        # "monthly" or "yearly" (values are converted to monthly)
    negotiable: bool
    experience_min: float | None
    experience_max: float | None
    city: str | None
    employer_group: str | None

    def to_dict(self) -> dict:
        return asdict(self)


def half_up(x: float) -> int:
    """Round half away from zero for positives, matching JavaScript Math.round."""
    return math.floor(x + 0.5)


def _to_number(value: str, unit: str | None) -> float:
    n = float(value.replace(",", ""))
    unit = (unit or "").lower()
    if unit in ("k", "thousand", "হাজার"):
        n *= 1_000
    elif unit in ("lakh", "lac", "লাখ"):
        n *= 100_000
    return n


def _salary_section(text: str) -> str:
    """Prefer the text near the word salary / বেতন; fall back to the whole post."""
    m = re.search(r"(salary|remuneration|compensation|বেতন)", text, re.I)
    if not m:
        return text
    return text[m.start(): m.start() + 160]


def parse_salary(text: str) -> tuple[float | None, float | None, str | None, bool]:
    t = text.translate(BN_DIGITS)
    negotiable = bool(re.search(r"negotiable|আলোচনা সাপেক্ষে|as per company policy", t, re.I))
    section = _salary_section(t)
    yearly = bool(re.search(r"\b(yearly|per annum|annual|p\.a\.)|বার্ষিক", section, re.I))
    lo = hi = None
    m = _RANGE.search(section)
    if m:
        unit_hi = m.group(4)
        unit_lo = m.group(2) or unit_hi           # "25-35k" -> both in thousands
        lo, hi = _to_number(m.group(1), unit_lo), _to_number(m.group(3), unit_hi)
    else:
        s = _SINGLE.search(section)
        if s:
            lo = hi = _to_number(s.group(1), s.group(2))
    if lo is None:
        return None, None, None, negotiable
    if lo > hi:
        lo, hi = hi, lo
    # Ignore numbers that cannot be a salary (years, phone numbers, tiny counts).
    if hi < 3_000 or hi > 5_000_000:
        return None, None, None, negotiable
    period = "yearly" if yearly or lo >= 600_000 else "monthly"
    if period == "yearly":
        lo, hi = lo / 12, hi / 12
    return half_up(lo), half_up(hi), period, negotiable


def parse_experience(text: str) -> tuple[float | None, float | None]:
    t = _AGE.sub(" ", text.translate(BN_DIGITS))
    if re.search(r"fresh(er)?s?\b.*(apply|encouraged|welcome)|no experience|অভিজ্ঞতার প্রয়োজন নেই", t, re.I):
        return 0.0, 1.0
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|–|to|থেকে)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?|বছর)", t, re.I)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(r"(?:at least|minimum|min\.?|ন্যূনতম)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?|বছর)", t, re.I)
    if m:
        return float(m.group(1)), None
    m = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|বছর)", t, re.I)
    if m:
        return float(m.group(1)), None
    return None, None


def detect_city(text: str) -> str | None:
    for city, pat in CITY_PATTERNS:
        if re.search(pat, text, re.I):
            return city
    return None


def _keyword_re(keywords: list[str]) -> re.Pattern:
    alts = "|".join(re.escape(k) for k in sorted(keywords, key=len, reverse=True))
    return re.compile(rf"(?<![a-z0-9])(?:{alts})(?![a-z0-9])", re.I)


def detect_group(text: str, taxonomy: dict) -> str | None:
    """Employer group from company names (e.g. 'Unilever', 'City Bank') or generic words ('multinational', 'NGO')."""
    groups = {g["id"]: g for g in taxonomy["groups"]}
    for gid in taxonomy["match_order"]:
        if groups[gid]["match"] and _keyword_re(groups[gid]["match"]).search(text):
            return gid
    return None


def parse(text: str, taxonomy: dict) -> ParsedJobPost:
    lo, hi, period, negotiable = parse_salary(text)
    emin, emax = parse_experience(text)
    return ParsedJobPost(salary_min=lo, salary_max=hi, salary_period=period, negotiable=negotiable,
                         experience_min=emin, experience_max=emax,
                         city=detect_city(text), employer_group=detect_group(text, taxonomy))


def level_for_years(years: float | None) -> str | None:
    if years is None:
        return None
    if years < 1:
        return "entry"
    if years < 3:
        return "junior"
    if years < 6:
        return "mid"
    if years < 10:
        return "senior"
    return "lead"


GENERIC_KEYWORDS = {"officer", "executive", "coordinator", "assistant manager", "senior officer", "principal officer"}


def match_function(title_and_text: str, functions: list[dict]) -> tuple[str | None, float]:
    """Keyword score per job function; the title line counts triple, generic words ('officer') half."""
    lines = title_and_text.strip().splitlines()
    title = lines[0].lower() if lines else ""
    body = title_and_text.lower()
    best, best_score = None, 0.0
    for role in functions:
        score = 0.0
        for kw in role["keywords"]:
            k = kw.lower()
            weight = 0.5 if k in GENERIC_KEYWORDS else 1.0
            if k in title:
                score += 3.0 * weight * (1 + len(k) / 20)
            elif k in body:
                score += 1.0 * weight * (1 + len(k) / 20)
        if score > best_score:
            best, best_score = role["id"], score
    return best, round(best_score, 2)
