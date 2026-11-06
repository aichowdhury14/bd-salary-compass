"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { Assessment } from "@/lib/recommend";
import { peopleBelow } from "@/lib/benchmark";
import { MAX_QUESTION_CHARS, MAX_QUESTIONS, recentHistory, type ChatTurn } from "@/lib/chat";
import { tk } from "@/lib/format";
import { SimpleMarkdown } from "./SimpleMarkdown";

export interface CoachProfile {
  role: string;
  level: string;
  employer: string;
  city: string;
  years: number;
  monthlyGross: number;
  skills: string[];
}

interface Message extends ChatTurn {
  by?: string; // which model wrote it
  failed?: boolean;
  stopped?: boolean;
}

const STARTERS = [
  { label: "Help me ask for a raise", text: "Help me ask for a raise. Give me a script and a 90-day plan." },
  { label: "Plan a job switch", text: "I want to switch to a better-paying job. How should I plan it?" },
  { label: "How do I get promoted?", text: "How can I get promoted to the next level where I work?" },
  { label: "বাংলায় বেতন আলোচনার স্ক্রিপ্ট", text: "আমার বেতন বাড়ানোর জন্য আলোচনার একটি স্ক্রিপ্ট আর ৯০ দিনের পরিকল্পনা দিন।" },
];

/**
 * Chat with the free AI coach about the salary check results. The conversation lives only in this
 * component's state: nothing is saved, and changing the inputs above starts a fresh chat.
 */
export function ChatCoach({ profile, assessment }: { profile: CoachProfile; assessment: Assessment }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const questions = messages.filter((m) => m.role === "user").length;
  const full = questions >= MAX_QUESTIONS;

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateLast = (fn: (m: Message) => Message) => setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);

  async function send(text: string, base: Message[] = messages) {
    const question = text.trim().slice(0, MAX_QUESTION_CHARS);
    if (!question || busy) return;
    const history: Message[] = [...base, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    resize();
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: recentHistory(history.filter((m) => !m.failed).map(({ role, content }) => ({ role, content }))),
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
      const by = res.headers.get("x-coach-model") ?? undefined;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const soFar = answer;
        updateLast((m) => ({ ...m, content: soFar, by }));
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") updateLast((m) => ({ ...m, stopped: true }));
      else updateLast((m) => ({ ...m, content: (e as Error).message, failed: true }));
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  /** Drop a failed answer and its question, then ask the question again. */
  function retry(index: number) {
    send(messages[index - 1].content, messages.slice(0, index - 1));
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
  }

  async function copy(index: number) {
    try {
      await navigator.clipboard.writeText(messages[index].content);
      setCopied(index);
      setTimeout(() => setCopied((c) => (c === index ? null : c)), 1500);
    } catch {
      // clipboard blocked (e.g. insecure context): nothing useful to do
    }
  }

  function resize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter is a new line. Not while a Bangla input method is composing a word.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const greeting =
    `Hi! I've read your results. You earn **${tk(profile.monthlyGross)}** a month, and out of 100 people in similar jobs about ` +
    `**${peopleBelow(assessment.percentile)}** earn less than you. Typical pay is **${tk(assessment.stats.p50)}**.\n\n` +
    "Ask me anything about negotiating, switching jobs or growing your pay, in English or বাংলা.";

  return (
    <div className="grid gap-3">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-busy={busy}
        aria-label="Chat with the AI coach"
        className="max-h-[65vh] min-h-[16rem] overflow-y-auto rounded-xl border border-line bg-surface-2/50 p-2 sm:p-4 space-y-4"
      >
        <AssistantBubble>
          <SimpleMarkdown text={greeting} />
        </AssistantBubble>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 sm:pl-10">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => send(s.text)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-gold-2 transition"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2 text-sm text-brand-ink">
                {m.content}
              </p>
            </div>
          ) : (
            <AssistantBubble key={i}>
              {m.failed ? (
                <div className="grid gap-2">
                  <p className="text-bad">{m.content}</p>
                  {!busy && (
                    <button type="button" onClick={() => retry(i)} className="justify-self-start text-sm underline text-ink-2">
                      Try again
                    </button>
                  )}
                </div>
              ) : m.content ? (
                <>
                  <SimpleMarkdown text={m.content} />
                  {m.stopped && <p className="mt-2 text-xs text-muted">(stopped)</p>}
                  {!(busy && i === messages.length - 1) && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <button type="button" onClick={() => copy(i)} className="underline hover:text-ink">
                        {copied === i ? "Copied" : "Copy"}
                      </button>
                      {m.by && <span>· Written by {m.by}</span>}
                    </p>
                  )}
                </>
              ) : m.stopped ? (
                <p className="text-xs text-muted">(stopped)</p>
              ) : (
                <TypingDots />
              )}
            </AssistantBubble>
          ),
        )}

        {full && !busy && (
          <p className="text-center text-xs text-muted">
            This chat has reached {MAX_QUESTIONS} questions. Start a new chat to keep going; this keeps the free AI available for everyone.
          </p>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 rounded-xl border border-line bg-surface p-2 focus-within:border-gold-2 focus-within:ring-1 focus-within:ring-gold-2"
      >
        <label htmlFor="coach-input" className="sr-only">
          Your question
        </label>
        {/* outline-none! beats the site-wide :focus-visible outline; the form's ring shows focus instead */}
        <textarea
          id="coach-input"
          ref={inputRef}
          rows={1}
          maxLength={MAX_QUESTION_CHARS}
          disabled={full}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          placeholder={full ? "Start a new chat to ask more" : "Ask a question… (e.g. What if my boss says no?)"}
          className="flex-1 min-w-0 resize-none bg-transparent px-2 py-1.5 text-base sm:text-sm text-ink placeholder:text-muted outline-none! disabled:opacity-60"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || full}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <p className="max-w-xl">
          Sends your job, level, city, salary rounded to ৳1,000 and your messages to a free AI service (Groq, or Cloudflare as a backup).
          Nothing is saved. AI can make mistakes, so check advice against the figures above. Please don&apos;t include your name.
        </p>
        {messages.length > 0 && (
          <button type="button" onClick={newChat} className="underline hover:text-ink">
            New chat
          </button>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {/* the avatar is hidden on phones, where every pixel of width goes to the answer */}
      <span aria-hidden className="mt-0.5 hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-semibold text-gold sm:grid">
        AI
      </span>
      <div className="min-w-0 max-w-full rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-2.5 text-sm sm:max-w-[92%] sm:px-3.5">{children}</div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1.5" aria-label="Writing">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
