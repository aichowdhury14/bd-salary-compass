import { describe, expect, it } from "vitest";
import taxVectors from "@/data/tax_test_vectors.json";
import jobVectors from "@/data/jobpost_test_vectors.json";
import { computeTax, taxFreeMonthlySalary, type TaxCategory } from "./tax";
import { parseJobPost, matchFunction, detectGroup } from "./jobpost";
import { bench, cellStats, effectiveYears, functionsFor, LEVEL_CENTRE, LEVEL_ORDER, levelForYears, peopleBelow, percentileOf, statsForYears } from "./benchmark";
import { publishedFigures } from "./companies";
import { govtPackage, basicSteps } from "./govtpay";
import { valueOffer, defaultOffer } from "./offers";
import { assess } from "./recommend";
import { tk, tkShort, parseAmount, monthName } from "./format";
import { cagr, forecast } from "./forecast";
import { buildScript, targetAsk, toBnDigits } from "./script";
import { raiseCheck, takeHome, whatIf } from "./paycheck";

describe("tax (parity with Python pipeline)", () => {
  it.each(taxVectors.map((v, i) => [i, v] as const))("vector %i", (_i, v) => {
    const r = computeTax({ ...v.input, category: v.input.category as TaxCategory });
    expect({
      exemption: r.exemption,
      taxableIncome: r.taxableIncome,
      grossTax: r.grossTax,
      rebate: r.rebate,
      netTax: r.netTax,
      minimumTaxApplied: r.minimumTaxApplied,
    }).toEqual(v.expected);
  });

  it("is tax-free up to Tk 50,000 a month for a general taxpayer", () => {
    expect(taxFreeMonthlySalary("general")).toBeCloseTo(50000);
    expect(computeTax({ annualSalary: 600000 }).netTax).toBe(0);
  });
});

describe("job post parser (parity with Python pipeline)", () => {
  const fns = Object.entries(bench.functions).map(([id, f]) => ({ id, keywords: f.keywords }));
  it.each(jobVectors.map((v) => [v.text.split("\n")[0], v] as const))("%s", (_t, v) => {
    const { function: fn, ...expected } = v.expected;
    expect(parseJobPost(v.text)).toEqual(expected);
    expect(matchFunction(v.text, fns)[0]).toBe(fn);
  });

  it("prefers company names over generic words", () => {
    expect(detectGroup("Join BRAC Bank PLC")).toBe("large_bank");
    expect(detectGroup("BRAC is hiring field staff")).toBe("ngo");
    expect(detectGroup("A leading commercial bank")).toBe("other_bank");
    expect(detectGroup("Our facility in Gazipur")).toBeNull();
  });
});

describe("benchmark", () => {
  it("orders quantiles and grows with experience for every job and employer", () => {
    for (const g of bench.groups) {
      for (const fn of functionsFor(g.id)) {
        const s = cellStats(fn, "mid", g.id);
        expect(s.p25).toBeLessThan(s.p50);
        expect(s.p50).toBeLessThan(s.p75);
        const medians = LEVEL_ORDER.map((l) => cellStats(fn, l, g.id).p50);
        expect([...medians].sort((a, b) => a - b)).toEqual(medians);
      }
    }
  });

  it("ranks multinational and bank trainees above local companies", () => {
    const e = (g: string) => cellStats("officer", "entry", g).p50;
    expect(e("mnc_fmcg")).toBeGreaterThan(e("local_conglomerate") * 1.8);
    expect(e("large_bank")).toBeGreaterThan(e("sme"));
  });

  it("puts the median at the 50th percentile", () => {
    const s = cellStats("software", "mid", "local_software");
    expect(percentileOf(Math.exp(s.mu), s)).toBeCloseTo(50, 5);
  });

  it("maps years to levels", () => {
    expect([0, 2, 4, 8, 15].map(levelForYears)).toEqual(["entry", "junior", "mid", "senior", "lead"]);
  });

  it("lists published company figures, named company first", () => {
    const rows = publishedFigures("large_bank", "officer", "The City Bank");
    expect(rows[0].company).toBe("The City Bank");
    expect(rows.some((r) => r.figure.median === 80000)).toBe(true);
  });
});

describe("government pay", () => {
  it("phases the grade 9 basic: 40% of the increase until Dec 2026", () => {
    expect(govtPackage({ grade: 9, step: 0, phase: "p1", location: "dhaka", over50: false, children: 0 }).basic).toBe(30800);
    const full = govtPackage({ grade: 9, step: 0, phase: "full", location: "dhaka", over50: false, children: 0 });
    expect(full.basic).toBe(44000);
    expect(full.houseRent).toBe(19800);
  });

  it("caps increments at the grade maximum", () => {
    const steps = basicSteps(9);
    expect(steps[0]).toBe(44000);
    expect(steps[steps.length - 1]).toBe(105900);
  });
});

describe("offers and recommendations", () => {
  it("values an offer net of tax and PF", () => {
    const v = valueOffer(defaultOffer("A", 100000));
    expect(v.annualCash).toBe(100000 * 12 + 60000 * 2);
    expect(v.annualTotalValue).toBeGreaterThan(v.takeHomeMonthlyAvg * 12);
  });

  it("tells an underpaid software engineer to negotiate and points to better employers", () => {
    const a = assess({ functionId: "software", groupId: "local_software", years: 4, level: "mid", city: "dhaka", monthlyGross: 40000 });
    expect(a.verdict.id).toBe("below");
    expect(a.recommendations.some((r) => r.kind === "negotiate")).toBe(true);
    expect(a.recommendations.some((r) => r.kind === "employer")).toBe(true);
    expect(a.recommendations[a.recommendations.length - 1].kind).toBe("inflation");
  });
});

describe("format", () => {
  it("formats taka the South Asian way", () => {
    expect(tk(125000)).toBe("৳1,25,000");
    expect(tkShort(48000)).toBe("৳48k");
    expect(tkShort(150000)).toBe("৳1.5 lakh");
    expect(parseAmount("৳৪৫,০০০")).toBe(45000);
    expect(monthName("2026-09")).toBe("September 2026");
  });
});

describe("experience and corner cases", () => {
  it("counts outside experience partly: 75% for a similar job, 40% for a different one", () => {
    expect(effectiveYears({ totalYears: 6, yearsHere: 2, earlierSameJob: true }).years).toBeCloseTo(5);
    expect(effectiveYears({ totalYears: 6, yearsHere: 2, earlierSameJob: false }).years).toBeCloseTo(3.6);
    expect(effectiveYears({ totalYears: 6, yearsHere: 6, earlierSameJob: false }).years).toBe(6);
  });

  it("clamps impossible experience input", () => {
    expect(effectiveYears({ totalYears: 3, yearsHere: 10, earlierSameJob: true })).toMatchObject({ here: 3, other: 0, years: 3 });
    expect(effectiveYears({ totalYears: -2, yearsHere: -1, earlierSameJob: true }).years).toBe(0);
    expect(effectiveYears({ totalYears: NaN, yearsHere: NaN, earlierSameJob: true }).years).toBe(0);
  });

  it("has no jumps at level boundaries and never falls with experience", () => {
    for (const g of bench.groups) {
      for (const fn of functionsFor(g.id)) {
        let prev = 0;
        for (let y = 0; y <= 15; y += 0.25) {
          const m = Math.exp(statsForYears(fn, g.id, y).mu); // unrounded
          expect(m).toBeGreaterThanOrEqual(prev);
          if (prev) expect(m / prev).toBeLessThan(1.08); // a quarter-year never adds more than 8% (old buckets jumped 59%)
          prev = m;
        }
      }
    }
  });

  it("matches the level estimates at the centre of each level", () => {
    for (const lvl of LEVEL_ORDER) {
      expect(statsForYears("officer", "large_bank", LEVEL_CENTRE[lvl]).p50).toBe(cellStats("officer", lvl, "large_bank").p50);
    }
  });

  it("explains the calculation: fresher pay x experience x city = median", () => {
    const s = statsForYears("finance", "local_conglomerate", 4, "chattogram");
    const b = s.breakdown;
    expect(b.freshMedian * b.experienceMultiplier * b.cityMultiplier).toBeCloseTo(s.p50, -3);
  });

  it("keeps bank pay realistic for 6 years at banks (SPO/AVP figures: 70k-150k)", () => {
    const s = statsForYears("officer", "large_bank", 6);
    expect(s.p50).toBeGreaterThan(100_000);
    expect(s.p50).toBeLessThan(140_000);
  });

  it("describes extreme salaries sensibly", () => {
    const low = assess({ functionId: "officer", groupId: "large_bank", years: 6, level: "senior", city: "dhaka", monthlyGross: 5000 });
    const high = assess({ functionId: "officer", groupId: "large_bank", years: 6, level: "senior", city: "dhaka", monthlyGross: 5_000_000 });
    expect(peopleBelow(low.percentile)).toBe("fewer than 1");
    expect(peopleBelow(high.percentile)).toBe("more than 99");
    expect(high.recommendations.every((r) => Number.isFinite(r.monthlyImpact))).toBe(true);
  });

  it("handles a zero-salary offer without NaN", () => {
    const v = valueOffer({ ...defaultOffer("Zero", 0), basicShare: 0 });
    expect(Object.values(v).every(Number.isFinite)).toBe(true);
    expect(v.tax).toBe(0);
  });
});

describe("career-switch advice stays realistic", () => {
  it("never tells a bank officer to move to an FMCG trainee track", () => {
    const a = assess({ functionId: "officer", groupId: "other_bank", years: 5, level: "mid", city: "dhaka", monthlyGross: 60000 });
    const sw = a.recommendations.find((r) => r.kind === "employer");
    expect(sw?.title ?? "").not.toMatch(/FMCG|multinational/i);
    if (sw) expect(sw.title).toMatch(/bank/i);
  });

  it("still compares specialist jobs across sectors", () => {
    const a = assess({ functionId: "software", groupId: "other_bank", years: 4, level: "mid", city: "dhaka", monthlyGross: 50000 });
    expect(a.recommendations.some((r) => r.kind === "employer")).toBe(true);
  });
});

describe("salary forecast", () => {
  const base = { functionId: "officer", groupId: "large_bank", city: "dhaka" as const, years: 5.25, monthlyGross: 110000, startYear: 2026 };

  it("gives a value for every requested horizon", () => {
    const f = forecast({ ...base, inflation: 0.06, realGrowth: 0.01 });
    expect(f.horizons.map((p) => p.t)).toEqual([5, 7, 10, 12, 15, 20, 25, 30]);
    expect(f.horizons[0].year).toBe(2031);
    expect(f.points[0].youNominal).toBe(110000);
  });

  it("separates inflation from real growth", () => {
    const f = forecast({ ...base, inflation: 0.06, realGrowth: 0 });
    const p10 = f.points[10];
    expect(p10.youNominal / p10.youReal).toBeCloseTo(1.06 ** 10, 1);
    // with no inflation and no market growth, only career growth remains
    const flat = forecast({ ...base, inflation: 0, realGrowth: 0 });
    expect(flat.points[10].youReal).toBe(flat.points[10].youNominal);
  });

  it("keeps your position relative to the market", () => {
    const f = forecast({ ...base, inflation: 0.06, realGrowth: 0.01 });
    for (const p of f.points) expect(p.youReal / p.marketReal).toBeCloseTo(f.ratio, 1);
  });

  it("never shrinks in today's money and flattens once experience passes 12 years", () => {
    const f = forecast({ ...base, inflation: 0.06, realGrowth: 0 });
    for (let t = 1; t <= 30; t++) expect(f.points[t].youReal).toBeGreaterThanOrEqual(f.points[t - 1].youReal);
    expect(f.points[30].youReal).toBe(f.points[20].youReal); // 25+ yrs: past the end of the curve
  });

  it("flags horizons past a typical career", () => {
    const f = forecast({ ...base, years: 20, totalYears: 20, inflation: 0.06, realGrowth: 0.01 });
    expect(f.horizons.find((p) => p.t === 30)!.pastCareer).toBe(true);
    expect(f.horizons.find((p) => p.t === 5)!.pastCareer).toBe(false);
  });

  it("survives silly inputs", () => {
    const f = forecast({ ...base, monthlyGross: 0, inflation: -1, realGrowth: 9 });
    expect(f.points.every((p) => Number.isFinite(p.youNominal) && p.youNominal > 0)).toBe(true);
    expect(cagr(0, 100, 5)).toBe(0);
  });
});

describe("forecast for a career switcher", () => {
  it("shows real total years but values pay on the experience that counts", () => {
    const f = forecast({ functionId: "officer", groupId: "large_bank", city: "dhaka", years: 5.25, totalYears: 6, monthlyGross: 110000, inflation: 0.06, realGrowth: 0.01, startYear: 2026 });
    expect(f.points[5].experience).toBe(11);
    expect(f.points[5].countedExperience).toBeCloseTo(10.25);
  });
});

describe("negotiation script (free, template-based)", () => {
  const a = assess({ functionId: "officer", groupId: "large_bank", years: 5.25, level: "mid", city: "dhaka", monthlyGross: 110000 });
  const base = { functionId: "officer", groupId: "large_bank", years: 5.25, monthlyGross: 110000, assessment: a };

  it("asks for the median when below it, the upper range when above it", () => {
    expect(targetAsk("raise", 60000, a).ask).toBe(Math.ceil(a.stats.p50 / 1000) * 1000);
    // never below the inflation floor, even when the median is only slightly above your pay
    expect(targetAsk("raise", 110000, a).ask).toBeGreaterThanOrEqual(110000 * 1.0834);
    expect(targetAsk("raise", (a.stats.p50 + a.stats.p75) / 2, a).ask).toBe(Math.ceil(a.stats.p75 / 1000) * 1000);
    expect(targetAsk("raise", a.stats.p75 * 1.5, a).ask).toBeGreaterThan(a.stats.p75 * 1.5);
  });

  it("asks for at least 20% more when negotiating a new offer", () => {
    expect(targetAsk("offer", 110000, a).ask).toBeGreaterThanOrEqual(132000);
  });

  it("writes English and Bangla scripts with the user's numbers and no template gaps", () => {
    const en = buildScript({ ...base, context: "raise", lang: "en" });
    const bn = buildScript({ ...base, context: "offer", lang: "bn" });
    expect(en.text).toContain("৳1,10,000");
    expect(bn.text).toContain(toBnDigits(tk(bn.ask))); // offers never reveal your current pay
    expect(bn.text).not.toContain(toBnDigits("৳1,10,000"));
    expect(bn.text).toMatch(/[\u0980-\u09FF]/);
    for (const t of [en.text, bn.text]) expect(t).not.toMatch(/undefined|NaN|\$\{/);
  });
});

describe("salary check explanations", () => {
  it("take-home: tax-free salary keeps all of it; PF lowers cash but earns a rebate", () => {
    const low = takeHome(40000);
    expect(low.monthlyTax).toBe(0);
    expect(low.takeHome).toBe(40000);
    expect(low.takeHomeWithPf).toBe(40000 - 2400);
    const high = takeHome(110000);
    expect(high.annualIncome).toBe(110000 * 12 + 66000 * 2);
    expect(high.takeHome).toBeLessThan(110000);
    // PF counts as an investment, so the tax with PF is lower than without
    expect(110000 - high.takeHomeWithPf - high.pfMonthly).toBeLessThan(high.monthlyTax);
    expect(takeHome(0).takeHome).toBe(0);
  });

  it("raise check: separates real from nominal raises", () => {
    const r = raiseCheck(100000, 110000, 0.0834)!;
    expect(r.nominal).toBeCloseTo(0.1);
    expect(r.real).toBeCloseTo(1.1 / 1.0834 - 1, 5);
    expect(r.verdict).toBe("beat");
    expect(raiseCheck(100000, 105000, 0.0834)!.verdict).toBe("lost");
    expect(raiseCheck(100000, 105000, 0.0834)!.shortfall).toBe(3340);
    expect(raiseCheck(100000, 108300, 0.0834)!.verdict).toBe("kept_up");
    expect(raiseCheck(0, 100000)).toBeNull();
  });

  it("what-if: includes you, compares bank officers only with banks, and grows with experience", () => {
    const w = whatIf({ functionId: "officer", groupId: "large_bank", years: 5, city: "dhaka" });
    expect(w.employers.filter((r) => r.current)).toHaveLength(1);
    expect(w.employers.every((r) => /bank/i.test(r.label))).toBe(true);
    const exp = w.experience.map((r) => r.typical);
    expect([...exp].sort((a, b) => a - b)).toEqual(exp);
    expect(w.cities.find((r) => r.key === "dhaka")!.current).toBe(true);
    expect(w.cities.find((r) => r.key === "district")!.change).toBeLessThan(0);
    // specialist jobs compare across sectors
    const ds = whatIf({ functionId: "data_science", groupId: "large_bank", years: 5, city: "dhaka" });
    expect(ds.employers.some((r) => r.key === "telecom")).toBe(true);
  });
});
