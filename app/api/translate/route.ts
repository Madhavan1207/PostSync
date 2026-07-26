import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithGeminiCascade } from "@/lib/gemini";

export const maxDuration = 30;

const LANG_MAP: Record<string, string> = {
  spanish: "es",
  french: "fr",
  german: "de",
  hindi: "hi",
  japanese: "ja",
  italian: "it",
  portuguese: "pt",
  english: "en",
  chinese: "zh-CN",
  russian: "ru",
  arabic: "ar",
  korean: "ko",
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, targetLang } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text to translate is required" }, { status: 400 });
    }

    const normalizedLang = (targetLang || "Spanish").toLowerCase().trim();
    const targetCode = LANG_MAP[normalizedLang] || "es";
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    // 1. If Google Cloud Translate API key is provided in env, use official GCP V2 API
    if (apiKey) {
      const gcpUrl = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
      const gcpRes = await fetch(gcpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          target: targetCode,
          format: "text",
        }),
      });

      if (gcpRes.ok) {
        const gcpData = await gcpRes.json();
        const translated = gcpData?.data?.translations?.[0]?.translatedText;
        if (translated) {
          return NextResponse.json({ translatedText: translated, provider: "Google Cloud Translate API" });
        }
      }
    }

    // 2. Official Google Translate Client Endpoint (gtx - zero config, instant)
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
      const gtxRes = await fetch(gtxUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (gtxRes.ok) {
        const gtxData = await gtxRes.json();
        if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
          const translatedParts = (gtxData[0] as Array<[string]>).map((part) => part[0]).filter(Boolean);
          const translatedText = translatedParts.join("");
          if (translatedText.trim()) {
            return NextResponse.json({ translatedText, provider: "Google Translate API" });
          }
        }
      }
    } catch {
      // Ignore network fallback error and try Gemini Google AI
    }

    // 3. Fallback to Google Gemini AI Cascade for translation
    const prompt = `Translate the following text into ${targetLang || "Spanish"}. Return ONLY the exact translated text without any explanations or quotation marks:\n\n${text}`;
    const geminiText = await generateWithGeminiCascade(prompt);
    
    return NextResponse.json({
      translatedText: geminiText.replace(/^["']|["']$/g, "").trim(),
      provider: "Google Gemini AI Translate",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}
