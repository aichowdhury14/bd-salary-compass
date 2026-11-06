// Free AI coach: a chain of free-tier providers that all speak the OpenAI chat-completions format.
// The route tries them in order and streams from the first one that accepts the request, so when
// one provider's daily free allowance runs out the next takes over. With no card on either
// account, hitting a limit only means a refused request (HTTP 429), never a bill.

export interface Provider {
  id: "groq" | "cloudflare";
  label: string;
  url: string;
  key: string;
  model: string;
  extra?: Record<string, unknown>; // provider-specific request fields
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function configuredProviders(env: Record<string, string | undefined> = process.env): Provider[] {
  const providers: Provider[] = [];
  if (env.GROQ_API_KEY) {
    providers.push({
      id: "groq",
      label: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: env.GROQ_API_KEY,
      // Picked over gpt-oss-120b/20b in a Nov 2026 test: the most natural Bangla, and it copied the
      // given numbers faithfully (both gpt-oss models invented figures). Llama is no longer on Groq's free plan.
      model: env.GROQ_MODEL || "qwen/qwen3.8-27b",
    });
  }
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    providers.push({
      id: "cloudflare",
      label: "Cloudflare Workers AI",
      url: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
      key: env.CLOUDFLARE_API_TOKEN,
      // ~25 Neurons per answer, so the free 10,000 a day covers roughly 390 answers; good at Bangla.
      model: env.CLOUDFLARE_MODEL || "@cf/google/gemma-4-26b-a4b-it",
      // Gemma 4 "thinks" first by default: in testing all 120 tokens went to hidden reasoning and the
      // answer was empty. This switches thinking off (reasoning_effort "none" did not).
      extra: { chat_template_kwargs: { enable_thinking: false } },
    });
  }
  return providers;
}

export type OpenResult =
  | { ok: true; provider: Provider; text: AsyncGenerator<string> }
  | { ok: false; failures: string[] };

/** Try each provider in turn; return a text stream from the first that answers with HTTP 200. */
export async function openFirst(
  providers: Provider[],
  messages: ChatMessage[],
  opts: { maxTokens: number; signal?: AbortSignal; fetchFn?: typeof fetch },
): Promise<OpenResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const failures: string[] = [];
  for (const provider of providers) {
    let res: Response;
    try {
      res = await fetchFn(provider.url, {
        method: "POST",
        headers: { authorization: `Bearer ${provider.key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: opts.maxTokens,
          temperature: 0.6,
          stream: true,
          ...provider.extra,
        }),
        signal: opts.signal,
      });
    } catch (err) {
      if (opts.signal?.aborted) throw err; // the visitor left; don't try the next provider
      failures.push(`${provider.id}: network error`);
      continue;
    }
    if (res.ok && res.body) return { ok: true, provider, text: readText(res) };
    failures.push(`${provider.id}: ${res.status}`); // 429 = free allowance used up, 401/403 = bad key
    await res.body?.cancel();
  }
  return { ok: false, failures };
}

/** Text pieces from a chat-completions response: streamed (server-sent events) or a single JSON body. */
export async function* readText(res: Response): AsyncGenerator<string> {
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const json = await res.json();
    const choice = json.choices?.[0];
    if (choice?.message?.content) yield choice.message.content;
    if (choice?.finish_reason === "length") yield CUT_SHORT;
    return;
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      const choice = JSON.parse(data).choices?.[0];
      if (choice?.delta?.content) yield choice.delta.content;
      if (choice?.finish_reason === "length") yield CUT_SHORT;
    }
  }
}

export const CUT_SHORT = "\n\n(Answer cut short.)";
