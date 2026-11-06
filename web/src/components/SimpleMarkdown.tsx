import type { ReactNode } from "react";
import Link from "next/link";

// **bold** and [label](/path) links. Only paths on this site become links (AI answers use them to point
// at the tools); anything else, such as an outside URL, stays plain text.
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]\n]+\]\(\/[\w\-/#?=&]*\))/g;
const LINK = /^\[([^\]]+)\]\((\/[^)]*)\)$/;

/** Minimal, safe Markdown (headings, lists, bold, internal links, paragraphs) built as React elements; no HTML injection. */
function inline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = LINK.exec(part);
    if (link)
      return (
        <Link key={i} href={link[2]} className="font-medium text-gold underline underline-offset-2 hover:opacity-80">
          {link[1]}
        </Link>
      );
    return part;
  });
}

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push(
        <h3 key={blocks.length} className="font-semibold mt-3">
          {inline(h[1])}
        </h3>,
      );
    } else if (ul || ol) {
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flush();
      list = list ?? { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}
