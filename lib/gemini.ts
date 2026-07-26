export const GEMINI_MODEL_CASCADE = [
  // 1. Gemini 3.6 Flash
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  // 2. Gemini 3.5 Flash
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  // 3. Gemini 3.5 Flash Lite
  "gemini-3.5-flash-lite",
  "gemini-2.0-flash-lite",
  // 4. Gemini 3.1 Flash Lite
  "gemini-3.1-flash-lite",
  "gemini-1.5-flash",
  // 5. Gemini 3 Flash
  "gemini-3-flash",
  "gemini-1.5-flash-8b",
  // 6. Gemini 2.5 Flash Lite
  "gemini-2.5-flash-lite",
  "gemini-1.5-pro",
  // 7. Gemini 2.5 Flash
  "gemini-1.0-pro",
];

/**
 * Collects all configured Gemini API keys from environment variables.
 * Supports:
 * - GEMINI_API_KEY
 * - GEMINI_API_KEYS (comma separated list)
 * - GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];

  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }

  if (process.env.GEMINI_API_KEYS) {
    const split = process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
    keys.push(...split);
  }

  for (let i = 1; i <= 20; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  }

  return Array.from(new Set(keys));
}

/**
 * Generates text using Google Gemini REST API with automatic multi-model and multi-key fallback.
 * It iterates through every available API key and model in the specified priority order until success.
 */
export async function generateWithGeminiCascade(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    throw new Error("No GEMINI_API_KEY configured in environment variables.");
  }

  let lastError: Error | null = null;

  for (const apiKey of keys) {
    for (const model of GEMINI_MODEL_CASCADE) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload: Record<string, unknown> = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        };

        if (systemInstruction) {
          payload.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && typeof text === "string" && text.trim().length > 0) {
            return text.trim();
          }
        } else {
          const errData = await res.text().catch(() => "");
          console.warn(`Gemini [Model: ${model}] [Key: ...${apiKey.slice(-4)}] returned ${res.status}:`, errData);
          lastError = new Error(`Gemini API error ${res.status}: ${errData}`);
        }
      } catch (err) {
        console.warn(`Gemini request failed [Model: ${model}]:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw lastError || new Error("All Gemini models and API keys were exhausted.");
}
