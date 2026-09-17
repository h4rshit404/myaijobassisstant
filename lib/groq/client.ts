import OpenAI from "openai";

export interface GroqClient {
  client: OpenAI;
  model: string;
}

/** Free Llama model on Groq's free tier — no cost, but rate-limited per Groq's published
 * free-tier limits and subject to rotation/retirement by Groq without notice. */
const FREE_LLAMA_MODEL = "llama-3.3-70b-versatile";

/** App-level fallback client (not per-user): returns null if GROQ_API_KEY isn't set. Groq
 * exposes an OpenAI-compatible endpoint, so this reuses the `openai` SDK like the OpenRouter
 * client does. */
export function getGroqClient(): GroqClient | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  return {
    client: new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" }),
    model: FREE_LLAMA_MODEL,
  };
}
