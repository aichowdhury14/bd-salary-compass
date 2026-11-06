import { describe, expect, it } from "vitest";
import { configuredProviders, CUT_SHORT, openFirst, type Provider } from "./coach";

const ENV = { GROQ_API_KEY: "g", CLOUDFLARE_API_TOKEN: "c", CLOUDFLARE_ACCOUNT_ID: "acct" };
const MESSAGES = [{ role: "user" as const, content: "hi" }];

function sse(...events: object[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}
const delta = (content: string, finish_reason: string | null = null) => ({ choices: [{ delta: { content }, finish_reason }] });

/** A fake fetch that answers each provider URL from a script and records the calls. */
function fakeFetch(answers: Record<string, () => Response | Promise<Response>>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    const key = Object.keys(answers).find((k) => url.includes(k))!;
    return answers[key]();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

async function collect(gen: AsyncGenerator<string>) {
  let text = "";
  for await (const piece of gen) text += piece;
  return text;
}

describe("coach providers", () => {
  it("configures nothing without keys, and Groq before Cloudflare when both are set", () => {
    expect(configuredProviders({})).toEqual([]);
    expect(configuredProviders({ CLOUDFLARE_API_TOKEN: "c" })).toEqual([]); // account id missing
    const both = configuredProviders(ENV);
    expect(both.map((p) => p.id)).toEqual(["groq", "cloudflare"]);
    expect(both[1].url).toContain("/accounts/acct/ai/v1/chat/completions");
    expect(both[1].model).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(configuredProviders({ ...ENV, GROQ_MODEL: "openai/gpt-oss-20b" })[0].model).toBe("openai/gpt-oss-20b");
  });

  it("streams from the first provider that accepts", async () => {
    const { fn, calls } = fakeFetch({ groq: () => sse(delta("Hello "), delta("there")) });
    const r = await openFirst(configuredProviders(ENV), MESSAGES, { maxTokens: 100, fetchFn: fn });
    expect(r.ok && r.provider.id).toBe("groq");
    expect(r.ok && (await collect(r.text))).toBe("Hello there");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ model: "qwen/qwen3.8-27b", max_tokens: 100, stream: true });
  });

  it("falls back to Cloudflare when Groq's free allowance is used up (429)", async () => {
    const { fn, calls } = fakeFetch({
      groq: () => new Response("rate limited", { status: 429 }),
      cloudflare: () => sse(delta("নমস্কার")),
    });
    const r = await openFirst(configuredProviders(ENV), MESSAGES, { maxTokens: 100, fetchFn: fn });
    expect(r.ok && r.provider.id).toBe("cloudflare");
    expect(r.ok && (await collect(r.text))).toBe("নমস্কার");
    expect(calls.map((c) => c.url.includes("groq"))).toEqual([true, false]);
    // Gemma 4's thinking must be off, or the answer comes back empty
    expect(calls[1].body).toMatchObject({ chat_template_kwargs: { enable_thinking: false } });
    expect(calls[0].body).not.toHaveProperty("chat_template_kwargs");
  });

  it("falls back on network errors too, and reports every failure when all providers fail", async () => {
    const { fn } = fakeFetch({
      groq: () => Promise.reject(new TypeError("fetch failed")),
      cloudflare: () => new Response("bad token", { status: 401 }),
    });
    const r = await openFirst(configuredProviders(ENV), MESSAGES, { maxTokens: 100, fetchFn: fn });
    expect(r).toEqual({ ok: false, failures: ["groq: network error", "cloudflare: 401"] });
  });

  it("does not try the next provider when the visitor has left", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const { fn, calls } = fakeFetch({ groq: () => Promise.reject(new DOMException("aborted", "AbortError")) });
    await expect(openFirst(configuredProviders(ENV), MESSAGES, { maxTokens: 100, fetchFn: fn, signal: ctrl.signal })).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("handles a non-streamed JSON reply and marks answers cut off by the token limit", async () => {
    const json = new Response(JSON.stringify({ choices: [{ message: { content: "Full answer" }, finish_reason: "length" }] }), {
      headers: { "content-type": "application/json" },
    });
    const { fn } = fakeFetch({ groq: () => json });
    const r = await openFirst(configuredProviders(ENV), MESSAGES, { maxTokens: 100, fetchFn: fn });
    expect(r.ok && (await collect(r.text))).toBe("Full answer" + CUT_SHORT);
  });

  it("reassembles events split across network chunks", async () => {
    const text = `data: ${JSON.stringify(delta("ab"))}\n\ndata: ${JSON.stringify(delta("cd", "length"))}\n\ndata: [DONE]\n\n`;
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); // split mid-JSON
        c.close();
      },
    });
    const { fn } = fakeFetch({ groq: () => new Response(body, { headers: { "content-type": "text/event-stream" } }) });
    const r = await openFirst([configuredProviders(ENV)[0] as Provider], MESSAGES, { maxTokens: 100, fetchFn: fn });
    expect(r.ok && (await collect(r.text))).toBe("abcd" + CUT_SHORT);
  });
});
