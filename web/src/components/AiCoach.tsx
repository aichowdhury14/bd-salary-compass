"use client";

import { useRef, useState } from "react";
import type { Assessment } from "@/lib/recommend";
import { Button, controlClass, Field, Segmented, Select } from "./ui";
import { SimpleMarkdown } from "./SimpleMarkdown";

type Goal = "negotiate" | "switch" | "grow" | "general";

export interface CoachProfile {
  role: string;
  level: string;
  employer: string;
  city: string;
  years: number;
  monthlyGross: number;
  skills: string[];
}

export function AiCoach({ profile, assessment }: { profile: CoachProfile; assessment: Assessment }) {
  const [goal, setGoal] = useState<Goal>("negotiate");
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function ask() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnswer("");
    setError("");
    setStatus("loading");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          lang,
          goal,
          question: question.trim(),
          profile: {
            role: profile.role.slice(0, 80),
            level: profile.level,
            employer: profile.employer.slice(0, 60),
            city: profile.city.slice(0, 80),
            years: profile.years,
            // Rounded before it leaves the browser.
            monthlyGross: Math.round(profile.monthlyGross / 1000) * 1000,
          },
          market: {
            p25: assessment.stats.p25,
            p50: assessment.stats.p50,
            p75: assessment.stats.p75,
            percentile: Math.round(assessment.percentile),
            confidence: assessment.stats.confidence,
          },
          recommendations: assessment.recommendations.slice(0, 6).map((r) => r.title),
          skills: profile.skills.slice(0, 6),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnswer(text);
      }
      setStatus("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">
        Claude writes a short script for your next salary conversation, a 90-day plan, and the risks to watch, based on the numbers
        above. English or Bangla.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Select<Goal>
          label="What do you want help with?"
          value={goal}
          onChange={setGoal}
          options={[
            { value: "negotiate", label: "Asking for a raise / negotiating an offer" },
            { value: "switch", label: "Switching to a better-paying job" },
            { value: "grow", label: "Getting promoted where I am" },
            { value: "general", label: "General career advice" },
          ]}
        />
        <div className="grid gap-1.5 content-start">
          <span className="text-sm font-medium">Language</span>
          <Segmented
            label="Answer language"
            value={lang}
            onChange={setLang}
            options={[
              { value: "en", label: "English" },
              { value: "bn", label: "বাংলা" },
            ]}
          />
        </div>
      </div>
      <Field label="Anything specific? (optional)" hint="Please don't include your name or other personal details.">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            maxLength={600}
            className={controlClass}
            placeholder="e.g. My appraisal is next month and I have another offer of ৳95,000"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={ask} disabled={status === "loading"}>
          {status === "loading" ? "Writing…" : answer ? "Ask again" : "Write my script"}
        </Button>
        <p className="text-xs text-muted max-w-md">
          Sends your job, level, city and salary rounded to ৳1,000 to Claude (Anthropic). Nothing is stored.
        </p>
      </div>
      {status === "error" && <p className="text-sm text-bad">{error}</p>}
      {answer && (
        <div className="rounded-lg border border-line bg-surface-2 p-4 text-sm" aria-live="polite">
          <SimpleMarkdown text={answer} />
        </div>
      )}
    </div>
  );
}
