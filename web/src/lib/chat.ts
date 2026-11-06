// Conversation helpers shared by the chat UI and the coach route.
// Every message re-sends the conversation, so it is trimmed to stay inside the free providers'
// per-minute token limits (Groq's free plan allows 8,000 tokens a minute).

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const MAX_QUESTIONS = 10; // per chat; then the visitor starts a new one
export const MAX_QUESTION_CHARS = 600;
const KEEP_MESSAGES = 7; // the last three answers plus the new question
const KEEP_ANSWER_CHARS = 2500;

/**
 * The part of the conversation the model sees: the recent turns, long answers shortened,
 * starting with a question and never two turns from the same side in a row (some models'
 * chat formats, such as Gemma's, reject that).
 */
export function recentHistory(turns: ChatTurn[]): ChatTurn[] {
  const merged: ChatTurn[] = [];
  for (const t of turns) {
    if (!t.content.trim()) continue;
    const last = merged[merged.length - 1];
    if (last?.role === t.role) last.content += `\n\n${t.content}`;
    else merged.push({ ...t });
  }
  const recent = merged.slice(-KEEP_MESSAGES);
  while (recent[0]?.role === "assistant") recent.shift();
  return recent.map((t) =>
    t.role === "assistant" && t.content.length > KEEP_ANSWER_CHARS ? { ...t, content: `${t.content.slice(0, KEEP_ANSWER_CHARS)} …` } : t,
  );
}

// Bangla letters only: the taka sign ৳ is in the same Unicode block but appears in English questions too.
const BANGLA = /[অ-হড়-য়]/;

/** Decided in code, not left to the model: reply in the language of the latest question. */
export function languageRule(latestQuestion: string): string {
  return BANGLA.test(latestQuestion)
    ? "The person's latest message is in Bangla: reply in Bangla (বাংলা). Keep amounts in taka."
    : "The person's latest message is in English: reply in English.";
}
