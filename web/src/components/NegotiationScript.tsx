"use client";

import { useState } from "react";
import type { Assessment } from "@/lib/recommend";
import { buildScript, type Lang, type ScriptContext } from "@/lib/script";
import { tk } from "@/lib/format";
import { Button, Segmented } from "./ui";

export function NegotiationScript(props: { functionId: string; groupId: string; years: number; monthlyGross: number; assessment: Assessment }) {
  const [context, setContext] = useState<ScriptContext>("raise");
  const [lang, setLang] = useState<Lang>("en");
  const [copied, setCopied] = useState(false);
  const s = buildScript({ ...props, context, lang });

  async function copy() {
    try {
      await navigator.clipboard.writeText(s.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <Segmented<ScriptContext>
          label="Situation"
          value={context}
          onChange={setContext}
          options={[
            { value: "raise", label: "Asking for a raise" },
            { value: "offer", label: "Negotiating a new offer" },
          ]}
        />
        <Segmented<Lang>
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            { value: "en", label: "English" },
            { value: "bn", label: "বাংলা" },
          ]}
        />
      </div>
      <p className="text-sm text-ink-2">
        Suggested ask: <strong className="num text-ink">{tk(s.ask)}</strong>, {s.why}.
      </p>
      <div className="rounded-lg border border-line bg-surface-2 p-4 text-sm leading-relaxed whitespace-pre-line" lang={lang === "bn" ? "bn" : "en"}>
        {s.text}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={copy}>{copied ? "Copied ✓" : "Copy script"}</Button>
        <span className="text-xs text-muted">Replace the [brackets] with your own details before you send it.</span>
      </div>
      <ul className="text-sm text-ink-2 grid sm:grid-cols-2 gap-x-6 gap-y-1" lang={lang === "bn" ? "bn" : "en"}>
        {s.tips.map((t) => (
          <li key={t} className="before:content-['→_'] before:text-gold">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
