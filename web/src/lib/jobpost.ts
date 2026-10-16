// Job post parser. Mirrors pipeline/salary_compass/jobpost.py; both are checked against
// src/data/jobpost_test_vectors.json. Runs entirely in the browser.
import { bench } from "./benchmark";

const BN = "০১২৩৪৫৬৭৮৯";
const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

const CITY_PATTERNS: [string, RegExp][] = [
  ["dhaka", /\b(dhaka|gulshan|banani|motijheel|mirpur|uttara|dhanmondi|tejgaon|mohakhali|gazipur|narayanganj|savar|ashulia|tongi|keraniganj)\b|ঢাকা|গাজীপুর|নারায়ণগঞ্জ/i],
  ["chattogram", /\b(chattogram|chittagong|ctg)\b|চট্টগ্রাম/i],
  ["other_city", /\b(sylhet|khulna|rajshahi|barishal|barisal|rangpur|mymensingh|cumilla|comilla)\b|সিলেট|খুলনা|রাজশাহী|বরিশাল|রংপুর|ময়মনসিংহ|কুমিল্লা/i],
];

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|লাখ|হাজার)?`;
const CUR = String.raw`(?:tk\.?|bdt|৳|taka|টাকা)`;
const RANGE = new RegExp(NUM + String.raw`\s*` + CUR + String.raw`?\s*(?:-|–|—|to|থেকে)\s*` + CUR + String.raw`?\s*` + NUM, "i");
// "Age 22-30 years", "maximum age 32 years", "বয়স ৩০ বছর": an age limit, not experience.
const AGE = /(?<![a-z])(?:age|বয়স)(?![a-z])[^\n\d]{0,20}\d+(?:\s*(?:-|–|to|থেকে)\s*\d+)?\s*(?:years?|yrs?|বছর)?/gi;
const SINGLE = new RegExp(String.raw`(?:tk\.?|bdt|৳|taka|salary[^\d\n]{0,20})\s*` + NUM, "i");

export interface ParsedJobPost {
  salary_min: number | null;
  salary_max: number | null;
  salary_period: "monthly" | "yearly" | null;
  negotiable: boolean;
  experience_min: number | null;
  experience_max: number | null;
  city: string | null;
  employer_group: string | null;
}

function toNumber(value: string, unit: string | undefined): number {
  let n = Number(value.replace(/,/g, ""));
  const u = (unit ?? "").toLowerCase();
  if (u === "k" || u === "thousand" || u === "হাজার") n *= 1_000;
  else if (u === "lakh" || u === "lac" || u === "লাখ") n *= 100_000;
  return n;
}

function salarySection(text: string): string {
  const m = /(salary|remuneration|compensation|বেতন)/i.exec(text);
  return m ? text.slice(m.index, m.index + 160) : text;
}

export function parseSalary(text: string): [number | null, number | null, "monthly" | "yearly" | null, boolean] {
  const t = toAsciiDigits(text);
  const negotiable = /negotiable|আলোচনা সাপেক্ষে|as per company policy/i.test(t);
  const section = salarySection(t);
  const yearly = /\b(yearly|per annum|annual|p\.a\.)|বার্ষিক/i.test(section);
  let lo: number | null = null;
  let hi: number | null = null;
  const m = RANGE.exec(section);
  if (m) {
    const unitHi = m[4];
    const unitLo = m[2] || unitHi;
    lo = toNumber(m[1], unitLo);
    hi = toNumber(m[3], unitHi);
  } else {
    const s = SINGLE.exec(section);
    if (s) lo = hi = toNumber(s[1], s[2]);
  }
  if (lo === null || hi === null) return [null, null, null, negotiable];
  if (lo > hi) [lo, hi] = [hi, lo];
  if (hi < 3_000 || hi > 5_000_000) return [null, null, null, negotiable];
  const period = yearly || lo >= 600_000 ? "yearly" : "monthly";
  if (period === "yearly") {
    lo /= 12;
    hi /= 12;
  }
  return [Math.round(lo), Math.round(hi), period, negotiable];
}

export function parseExperience(text: string): [number | null, number | null] {
  const t = toAsciiDigits(text).replace(AGE, " ");
  if (/fresh(er)?s?\b.*(apply|encouraged|welcome)|no experience|অভিজ্ঞতার প্রয়োজন নেই/i.test(t)) return [0, 1];
  let m = /(\d+(?:\.\d+)?)\s*(?:-|–|to|থেকে)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?|বছর)/i.exec(t);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /(?:at least|minimum|min\.?|ন্যূনতম)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?|বছর)/i.exec(t);
  if (m) return [Number(m[1]), null];
  m = /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|বছর)/i.exec(t);
  if (m) return [Number(m[1]), null];
  return [null, null];
}

export function detectCity(text: string): string | null {
  for (const [city, re] of CITY_PATTERNS) if (re.test(text)) return city;
  return null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GROUP_PATTERNS: [string, RegExp][] = bench.match_order
  .map((id) => bench.groups.find((g) => g.id === id)!)
  .filter((g) => g.match.length)
  .map((g) => {
    const alts = [...g.match].sort((a, b) => b.length - a.length).map(escape).join("|");
    return [g.id, new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`, "i")];
  });

/** Employer group from company names (e.g. "Unilever", "City Bank") or generic words ("multinational", "NGO"). */
export function detectGroup(text: string): string | null {
  for (const [id, re] of GROUP_PATTERNS) if (re.test(text)) return id;
  return null;
}

export function parseJobPost(text: string): ParsedJobPost {
  const [salary_min, salary_max, salary_period, negotiable] = parseSalary(text);
  const [experience_min, experience_max] = parseExperience(text);
  return {
    salary_min,
    salary_max,
    salary_period,
    negotiable,
    experience_min,
    experience_max,
    city: detectCity(text),
    employer_group: detectGroup(text),
  };
}

const GENERIC_KEYWORDS = new Set(["officer", "executive", "coordinator", "assistant manager", "senior officer", "principal officer"]);

/** Keyword score per job function; the title line counts triple, generic words ("officer") half. */
export function matchFunction(text: string, functions: { id: string; keywords: string[] }[]): [string | null, number] {
  const lines = text.trim().split(/\r?\n/);
  const title = (lines[0] ?? "").toLowerCase();
  const body = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const role of functions) {
    let score = 0;
    for (const kw of role.keywords) {
      const k = kw.toLowerCase();
      const weight = GENERIC_KEYWORDS.has(k) ? 0.5 : 1;
      if (title.includes(k)) score += 3 * weight * (1 + k.length / 20);
      else if (body.includes(k)) score += weight * (1 + k.length / 20);
    }
    if (score > bestScore) {
      best = role.id;
      bestScore = score;
    }
  }
  return [best, Math.round(bestScore * 100) / 100];
}
