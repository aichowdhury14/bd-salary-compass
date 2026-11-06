import Link from "next/link";

const AI_COACH_ENABLED = process.env.NEXT_PUBLIC_AI_COACH === "on";

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-6 sm:grid-cols-3 text-sm">
        <div>
          <p className="font-serif text-base font-semibold">Salary Compass</p>
          <p className="text-ink-2 mt-1">Pay data for people working in Bangladesh. Free, with every figure sourced.</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Privacy</p>
          <p className="text-ink-2">
            Every calculation runs in your browser. Your salary is never stored or logged.
            {AI_COACH_ENABLED && " If you use the optional AI chat, your messages go to a free AI service to write the answers."}
          </p>
        </div>
        <div>
          <p className="eyebrow mb-1">Data</p>
          <p className="text-ink-2">
            Updated November 2026. <Link className="underline underline-offset-2" href="/methodology">Sources & method</Link>
          </p>
        </div>
      </div>
      {/* extra bottom room when the floating "Ask AI" button is there, so it never covers this line */}
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${AI_COACH_ENABLED ? "pb-24" : "pb-8"} flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-xs text-muted`}>
        <p>These are estimates for guidance, not financial or tax advice. Check tax figures with NBR and pay details with your employer.</p>
        <p>
          Designed and developed by <span className="font-medium text-ink">Atiqul Islam Chowdhury</span> · © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
