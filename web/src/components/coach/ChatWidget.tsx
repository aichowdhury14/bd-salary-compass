"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { peopleBelow } from "@/lib/benchmark";
import { MAX_QUESTION_CHARS, MAX_QUESTIONS, recentHistory, type ChatTurn } from "@/lib/chat";
import { tk } from "@/lib/format";
import { pageFor, PAGES, type PagePath } from "@/lib/siteFacts";
import { SimpleMarkdown } from "../SimpleMarkdown";
import { useCoach, type SalaryContext } from "./CoachProvider";

interface Message extends ChatTurn {
  failed?: boolean;
  stopped?: boolean;
}

interface Starter {
  label: string;
  text?: string; // what is sent, if different from the label
}

const STARTERS: Record<PagePath, Starter[]> = {
  "/": [
    { label: "What should a fresh graduate earn?" },
    { label: "Which employers pay the most?" },
    { label: "How do I switch to a better-paying job?" },
    { label: "আমার বেতন কম কিনা কীভাবে বুঝব?" },
  ],
  "/check": [
    { label: "How does the salary check work?" },
    { label: "What should I ask for in my next raise?" },
    { label: "How do I get promoted?" },
    { label: "বেতন বাড়ানোর কথা কীভাবে বলব?" },
  ],
  "/tax": [
    { label: "How is tax on salary calculated?" },
    { label: "How can I legally pay less tax?" },
    { label: "What is the tax-free income limit?" },
    { label: "করমুক্ত আয়সীমা কত?" },
  ],
  "/offers": [
    { label: "How should I compare two job offers?" },
    { label: "Is a provident fund worth it?" },
    { label: "What should I ask HR before accepting?" },
    { label: "অফার নেওয়ার আগে কী কী দেখব?" },
  ],
  "/job-post": [
    { label: "How do I tell if a job post's pay is fair?" },
    { label: "What do I ask for when pay is 'negotiable'?" },
    { label: "What red flags should I watch for in job posts?" },
    { label: "বিজ্ঞপ্তিতে বেতন না থাকলে কত চাইব?" },
  ],
  "/govt": [
    { label: "Government or private job: which pays better?" },
    { label: "How does the 2026 pay scale work?" },
    { label: "Is a BCS job worth it financially?" },
    { label: "সরকারি না বেসরকারি চাকরি, কোনটা ভালো?" },
  ],
  "/insights": [
    { label: "Who pays fresh graduates the most?" },
    { label: "How has inflation affected salaries?" },
    { label: "Which jobs pay the most in Bangladesh?" },
    { label: "ফ্রেশ গ্র্যাজুয়েটদের বেতন কত?" },
  ],
  "/methodology": [
    { label: "How are these salary estimates made?" },
    { label: "How accurate are the estimates?" },
    { label: "Is my data stored anywhere?" },
    { label: "এই তথ্য কোথা থেকে আসে?" },
  ],
};

// On the Salary check, once results exist, the starters are about them.
const RESULT_STARTERS: Starter[] = [
  { label: "Help me ask for a raise", text: "Help me ask for a raise. Give me a script and a 90-day plan." },
  { label: "Plan a job switch", text: "I want to switch to a better-paying job. How should I plan it?" },
  { label: "How do I get promoted?", text: "How can I get promoted to the next level where I work?" },
  { label: "বাংলায় বেতন আলোচনার স্ক্রিপ্ট", text: "আমার বেতন বাড়ানোর জন্য আলোচনার একটি স্ক্রিপ্ট আর ৯০ দিনের পরিকল্পনা দিন।" },
];

function requestSalary(s: SalaryContext) {
  const { profile: p, assessment: a } = s;
  return {
    profile: {
      role: p.role.slice(0, 80),
      level: p.level,
      employer: p.employer.slice(0, 60),
      city: p.city.slice(0, 80),
      years: p.years,
      // Rounded before it leaves the browser.
      monthlyGross: Math.round(p.monthlyGross / 1000) * 1000,
    },
    market: { p25: a.stats.p25, p50: a.stats.p50, p75: a.stats.p75, percentile: Math.round(a.percentile), confidence: a.stats.confidence },
    recommendations: a.recommendations.slice(0, 6).map((r) => r.title),
    skills: p.skills.slice(0, 6),
  };
}

/**
 * The AI coach as a floating chat on every page. It lives in the root layout, so the conversation
 * carries on while the visitor moves between pages. Nothing is saved: a reload starts afresh.
 */
export function ChatWidget() {
  const { salary, open, setOpen } = useCoach();
  const page = pageFor(usePathname());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const full = messages.filter((m) => m.role === "user").length >= MAX_QUESTIONS;
  const personal = page === "/check" ? salary : null; // results-based greeting and starters
  const starters = personal ? RESULT_STARTERS : STARTERS[page];

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Focus the box on open and the launcher again on close; Escape closes; on phones the chat covers
  // the page, so stop the page scrolling behind it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) launcherRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    if (window.matchMedia("(max-width: 639px)").matches) document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, setOpen]);

  // A link in an answer (e.g. to the tax page) navigates; on phones, close the chat so the page shows.
  const firstPath = useRef(page);
  useEffect(() => {
    if (firstPath.current === page) return;
    firstPath.current = page;
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }, [page, setOpen]);

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
          page,
          messages: recentHistory(history.filter((m) => !m.failed).map(({ role, content }) => ({ role, content }))),
          ...(salary ? { salary: requestSalary(salary) } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      // The model's name stays in the x-coach-model response header for debugging; it isn't shown.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const soFar = answer;
        updateLast((m) => ({ ...m, content: soFar }));
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
    inputRef.current?.focus();
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
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
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

  const greeting = personal
    ? `Hi! I've read your results. You earn **${tk(personal.profile.monthlyGross)}** a month, and out of 100 people in similar jobs about ` +
      `**${peopleBelow(personal.assessment.percentile)}** earn less than you. Typical pay is **${tk(personal.assessment.stats.p50)}**.\n\n` +
      "Ask me anything about negotiating, switching jobs or growing your pay, in English or বাংলা."
    : "Hi! I'm the Salary Compass AI coach. Ask me about pay, income tax, job offers or your career in Bangladesh, in English or বাংলা." +
      (page === "/" ? "" : `\n\nYou're on **${PAGES[page]}**. Some questions people ask here:`);

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="ai-coach"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-brand-ink shadow-[0_8px_24px_-8px_rgba(20,27,45,0.5)] transition hover:opacity-90"
        >
          <ChatIcon />
          Ask AI
          {messages.length > 0 && <span aria-label="conversation in progress" className="h-2 w-2 rounded-full bg-gold-2" />}
        </button>
      )}

      {open && (
        <div
          id="ai-coach"
          role="dialog"
          aria-label="AI coach"
          className="fixed inset-0 z-40 flex flex-col bg-surface sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(640px,calc(100dvh-2rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-line sm:shadow-[0_16px_48px_-12px_rgba(20,27,45,0.45)]"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-semibold text-gold">
              AI
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif font-semibold leading-tight">AI coach</p>
              <p className="text-xs text-muted">Free · English or বাংলা</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={newChat} className="rounded-md px-2 py-1 text-xs text-ink-2 underline hover:text-ink">
                New chat
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the AI coach" className="grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink">
              <CloseIcon />
            </button>
          </header>

          <div ref={logRef} role="log" aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-2/50 px-3 py-4">
            <Bubble>
              <SimpleMarkdown text={greeting} />
            </Bubble>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => send(s.text ?? s.label)}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink transition hover:border-gold-2"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2 text-sm text-brand-ink">{m.content}</p>
                </div>
              ) : (
                <Bubble key={i}>
                  {m.failed ? (
                    <div className="grid gap-2">
                      <p className="text-bad">{m.content}</p>
                      {!busy && (
                        <button type="button" onClick={() => retry(i)} className="justify-self-start text-sm text-ink-2 underline">
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
                        </p>
                      )}
                    </>
                  ) : m.stopped ? (
                    <p className="text-xs text-muted">(stopped)</p>
                  ) : (
                    <TypingDots />
                  )}
                </Bubble>
              ),
            )}

            {full && !busy && (
              <p className="text-center text-xs text-muted">
                This chat has reached {MAX_QUESTIONS} questions. Start a new chat to keep going; this keeps the free AI available for everyone.
              </p>
            )}
          </div>

          <div className="border-t border-line p-3">
            <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-xl border border-line bg-surface p-1.5 focus-within:border-gold-2 focus-within:ring-1 focus-within:ring-gold-2">
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
                placeholder={full ? "Start a new chat to ask more" : "Ask about pay, tax or your career…"}
                className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-ink outline-none! placeholder:text-muted disabled:opacity-60 sm:text-sm"
              />
              {busy ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-2">
                  Stop
                </button>
              ) : (
                <button type="submit" disabled={!input.trim() || full} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink transition hover:opacity-90 disabled:opacity-50">
                  Send
                </button>
              )}
            </form>
            <p className="mt-2 text-[11px] leading-snug text-muted">
              Free AI (Groq, or Cloudflare as a backup) writes the answers from your messages
              {salary ? " and your Salary check results (salary rounded to ৳1,000)" : ""}. Nothing is saved. AI can make mistakes. Please don&apos;t include your name.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return <div className="max-w-full rounded-2xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 text-sm">{children}</div>;
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

function ChatIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
