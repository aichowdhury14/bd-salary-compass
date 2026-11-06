import { describe, expect, it } from "vitest";
import insights from "@/data/insights.json";
import { pageFor, PAGES, SITE_FACTS } from "./siteFacts";

describe("AI coach fact sheet", () => {
  it("links every tool page", () => {
    for (const path of Object.keys(PAGES).filter((p) => p !== "/")) expect(SITE_FACTS).toContain(`](${path})`);
  });

  it("uses the site's own figures", () => {
    expect(SITE_FACTS).toContain("৳4,00,000 for general"); // tax-free threshold
    expect(SITE_FACTS).toContain("৳80,000/month pays ৳24,000 a year"); // from the tax curve
    expect(SITE_FACTS).toContain("8.34%"); // inflation
    for (const g of insights.market.entry_by_group) expect(SITE_FACTS).toContain(g.label);
  });

  it("stays small, because it is sent with every chat message", () => {
    expect(SITE_FACTS.length).toBeLessThan(5_000);
  });

  it("maps unknown paths to the home page", () => {
    expect(pageFor("/tax")).toBe("/tax");
    expect(pageFor("/something-else")).toBe("/");
  });
});
