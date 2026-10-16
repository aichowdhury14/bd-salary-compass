// Negotiation script generator: fills plain templates (English / Bangla) with the user's own
// numbers. Free, instant, and runs in the browser; no AI service is called.
import cpi from "@/data/cpi.json";
import { group, jobFunction } from "./benchmark";
import { tk } from "./format";
import type { Assessment } from "./recommend";

export type ScriptContext = "raise" | "offer";
export type Lang = "en" | "bn";

export interface ScriptInput {
  context: ScriptContext;
  lang: Lang;
  functionId: string;
  groupId: string;
  years: number;
  monthlyGross: number;
  assessment: Assessment;
}

export interface Script {
  ask: number;
  why: string;
  text: string;
  tips: string[];
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string) => s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
const up1000 = (v: number) => Math.ceil(v / 1000) * 1000;

/** What to ask for, and why (in English; shown in the UI). */
export function targetAsk(context: ScriptContext, salary: number, a: Assessment): { ask: number; why: string } {
  const { p50, p75 } = a.stats;
  const inflation = cpi.latest_point_to_point.rate;
  if (context === "offer") {
    const ask = up1000(Math.max(p50, salary * 1.2));
    return { ask, why: ask === up1000(p50) ? "the typical pay for this job (median)" : "about 20% above your current pay, a usual step when switching jobs" };
  }
  const floor = up1000(salary * (1 + inflation)); // never ask for less than keeping up with prices
  const target =
    salary < p50
      ? { ask: up1000(p50), why: "the typical pay for your job and experience (median)" }
      : salary < p75
        ? { ask: up1000(p75), why: "the upper end of the fair range, since you're already above typical" }
        : { ask: up1000(salary * (1 + inflation + 0.03)), why: "inflation plus a modest real raise, since you're already near the top of the range" };
  return target.ask >= floor ? target : { ask: floor, why: `your current pay plus inflation (${(inflation * 100).toFixed(1)}%), so the raise isn't a real pay cut. Typical pay is close to what you earn` };
}

export function buildScript(inp: ScriptInput): Script {
  const fn = jobFunction(inp.functionId);
  const g = group(inp.groupId);
  const { p25, p50, p75 } = inp.assessment.stats;
  const { ask, why } = targetAsk(inp.context, inp.monthlyGross, inp.assessment);
  const yrs = Math.round(inp.years);
  const floor = up1000(inp.monthlyGross * (1 + cpi.latest_point_to_point.rate));
  const bn = inp.lang === "bn";
  const m = (v: number) => (bn ? toBnDigits(tk(v)) : tk(v));
  const y = bn ? toBnDigits(String(yrs)) : String(yrs);

  let text: string;
  if (inp.context === "raise") {
    text = bn
      ? [
          `আসসালামু আলাইকুম [ম্যানেজারের নাম],`,
          `সময় দেওয়ার জন্য ধন্যবাদ। গত এক বছরে আমি [আপনার ২-৩টি অর্জন লিখুন, যেমন: টার্গেট পূরণ, নতুন প্রজেক্ট, খরচ কমানো]।`,
          `বাজারের তথ্য অনুযায়ী, প্রায় ${y} বছরের অভিজ্ঞতায় ${g.label_bn}-এ ${fn.title_bn} পদে সাধারণ বেতন প্রায় ${m(p50)}, আর উপরের দিকে ${m(p75)} পর্যন্ত। আমার বর্তমান বেতন ${m(inp.monthlyGross)}।`,
          `আমার কাজ ও দায়িত্ব বিবেচনা করে আমি বেতন ${m(ask)}-এ সমন্বয়ের অনুরোধ করছি। প্রয়োজনে ধাপে ধাপে, যেমন এখন কিছুটা আর পরের মূল্যায়নে বাকিটা, এভাবেও আলোচনা করতে আমি আগ্রহী।`,
          `ধন্যবাদ।`,
        ].join("\n\n")
      : [
          `Assalamu alaikum [manager's name],`,
          `Thank you for your time. Over the past year I have [add 2-3 results: targets met, projects delivered, costs saved].`,
          `I've also looked at the market. For a ${fn.short.toLowerCase()} with about ${y} years' experience at a ${g.label.toLowerCase()}, typical pay is around ${m(p50)}, and the upper range is about ${m(p75)}. My current salary is ${m(inp.monthlyGross)}.`,
          `Given my contribution, I'd like to request an adjustment to ${m(ask)}. I'm happy to discuss how we get there, for example part now and the rest at my next review.`,
          `Thank you.`,
        ].join("\n\n");
  } else {
    text = bn
      ? [
          `অফারের জন্য ধন্যবাদ। এই দায়িত্ব নিয়ে আমি আগ্রহী।`,
          `নিশ্চিত করার আগে বেতন নিয়ে একটু আলোচনা করতে চাই। বাজারের তথ্য অনুযায়ী, প্রায় ${y} বছরের অভিজ্ঞতায় ${g.label_bn}-এ ${fn.title_bn} পদে সাধারণ বেতন ${m(p25)} থেকে ${m(p75)}-এর মধ্যে। আমার অভিজ্ঞতা [আপনার মূল দক্ষতা লিখুন] বিবেচনায় ${m(ask)} হলে আমি স্বাচ্ছন্দ্যে যোগ দিতে পারি।`,
          `সাথে পুরো প্যাকেজটাও জানতে চাই: উৎসব বোনাস, প্রভিডেন্ট ফান্ড, গ্র্যাচুইটি এবং বাৎসরিক ইনক্রিমেন্টের নিয়ম।`,
          `আশা করি আমরা একমত হতে পারব। ধন্যবাদ।`,
        ].join("\n\n")
      : [
          `Thank you for the offer. I'm genuinely excited about the role.`,
          `Before I confirm, I'd like to discuss the salary. Market data puts the typical range for a ${fn.short.toLowerCase()} with about ${y} years' experience at a ${g.label.toLowerCase()} at ${m(p25)}-${m(p75)}. Given my experience in [add your key strengths], I'd be comfortable joining at ${m(ask)}.`,
          `I'd also like to understand the full package: festival bonuses, provident fund, gratuity and the annual increment policy.`,
          `I'm keen to join and hope we can agree on this. Thank you.`,
        ].join("\n\n");
  }

  const tips = bn
    ? [
        "সংখ্যা দিয়ে কথা বলুন: কোন টার্গেট পূরণ করেছেন, কত টাকা আয় বা সাশ্রয় করেছেন।",
        `${m(floor)}-এর কম হলে সেটা আসলে বেতন কমানো, কারণ মূল্যস্ফীতি এখন ${toBnDigits((cpi.latest_point_to_point.rate * 100).toFixed(1))}%।`,
        "চূড়ান্ত অফার ও সুবিধাগুলো লিখিত নিয়োগপত্রে নিন।",
        "সময় বুঝে কথা বলুন: অনেক প্রতিষ্ঠানে মূল্যায়ন জানুয়ারি বা জুলাইয়ে হয়।",
      ]
    : [
        "Lead with numbers: targets hit, revenue earned, costs saved.",
        `Anything below ${m(floor)} is a real pay cut (inflation is ${(cpi.latest_point_to_point.rate * 100).toFixed(1)}%).`,
        "Get the final offer and benefits in a written appointment letter.",
        "Time it well: many employers run appraisals in January or July.",
      ];
  return { ask, why, text, tips };
}
