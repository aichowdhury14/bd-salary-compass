import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SimpleMarkdown } from "./SimpleMarkdown";

const html = (text: string) => renderToStaticMarkup(createElement(SimpleMarkdown, { text }));

describe("SimpleMarkdown links (used by AI answers)", () => {
  it("turns links to this site's pages into links", () => {
    const out = html("Open [Take-home & tax](/tax) to see your exact tax.");
    expect(out).toMatch(/<a [^>]*href="\/tax"[^>]*>Take-home &amp; tax<\/a>/);
  });

  it("leaves outside links as plain text, so an AI answer can't send people elsewhere", () => {
    const out = html("See [my site](https://example.com) or [this](//evil.example).");
    expect(out).not.toContain("<a ");
    expect(out).toContain("[my site](https://example.com)");
  });

  it("still renders bold next to links", () => {
    expect(html("**Tip:** try [Salary check](/check)")).toMatch(/<strong>Tip:<\/strong> try <a [^>]*href="\/check"/);
  });
});
