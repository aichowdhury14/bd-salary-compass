import { describe, expect, it } from "vitest";
import { languageRule, recentHistory, type ChatTurn } from "./chat";

const q = (content: string): ChatTurn => ({ role: "user", content });
const a = (content: string): ChatTurn => ({ role: "assistant", content });

describe("chat history sent to the model", () => {
  it("keeps a short conversation as it is", () => {
    const turns = [q("raise?"), a("Here is a plan"), q("what if they say no?")];
    expect(recentHistory(turns)).toEqual(turns);
  });

  it("keeps only the last three answers plus the new question, starting with a question", () => {
    const turns: ChatTurn[] = [];
    for (let i = 1; i <= 6; i++) turns.push(q(`q${i}`), a(`a${i}`));
    turns.push(q("q7"));
    const h = recentHistory(turns);
    expect(h.map((t) => t.content)).toEqual(["q4", "a4", "q5", "a5", "q6", "a6", "q7"]);
    expect(h[0].role).toBe("user");
  });

  it("never sends two turns from the same side in a row (Gemma rejects that)", () => {
    // a failed answer is dropped by the UI, leaving two questions back to back
    const h = recentHistory([q("first"), q("second"), a(""), a("answer"), q("third")]);
    expect(h).toEqual([q("first\n\nsecond"), a("answer"), q("third")]);
  });

  it("shortens long answers to save tokens, but never the question", () => {
    const long = "x".repeat(5000);
    const h = recentHistory([q("plan?"), a(long), q(long.slice(0, 600))]);
    expect(h[1].content.length).toBeLessThan(2600);
    expect(h[2].content).toHaveLength(600);
  });

  it("does not mutate the caller's messages", () => {
    const turns = [q("one"), q("two")];
    recentHistory(turns);
    expect(turns).toEqual([q("one"), q("two")]);
  });
});

describe("reply language", () => {
  it("follows the language of the latest question", () => {
    expect(languageRule("আমার বেতন কত হওয়া উচিত?")).toContain("Bangla");
    expect(languageRule("Should I ask for 1 lakh?")).toContain("English");
    expect(languageRule("salary ৳90,000 ki kom?")).toContain("English"); // the taka sign alone isn't Bangla text
  });
});
