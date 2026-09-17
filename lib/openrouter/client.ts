import OpenAI from "openai";

export interface OpenRouterClient {
  client: OpenAI;
  model: string;
}

/** Free Grok model on OpenRouter's free tier — no cost, but rate-limited and subject to
 * rotation/retirement by OpenRouter without notice. */
const FREE_GROK_MODEL = "x-ai/grok-4-fast:free";

/** App-level fallback client (not per-user): returns null if OPENROUTER_API_KEY isn't set. */
export function getOpenRouterClient(): OpenRouterClient | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return {
    client: new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" }),
    model: FREE_GROK_MODEL,
  };
}
