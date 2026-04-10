import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TtsProvider, TtsSynthesisResult } from "../interfaces/tts-provider.interface";

type GeminiContentPart = {
  inlineData?: { data?: string };
  inline_data?: { data?: string };
};

function extractAudioBase64(result: unknown): string | null {
  const candidates = (result as { candidates?: { content?: { parts?: GeminiContentPart[] } }[] })?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const d = part?.inlineData?.data ?? part?.inline_data?.data;
    if (d) return d;
  }
  return null;
}

/** Google Gemini TTS — swap model via GEMINI_TTS_MODEL without code changes. */
@Injectable()
export class GeminiTtsProvider implements TtsProvider {
  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, voice: string): Promise<TtsSynthesisResult> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      throw new InternalServerErrorException("GEMINI_API_KEY is not configured");
    }

    const configured = this.config.get<string>("GEMINI_TTS_MODEL")?.trim();
    /** Preview model is the most broadly compatible default; Lite is attempted second when unset (latency). */
    const modelCandidates = configured
      ? [configured]
      : ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-lite-preview-tts"];

    /** Only the seminar script is spoken; tone comes from `voice` + model (do not prepend style lines—they get read aloud). */
    const body = {
      contents: [
        {
          parts: [
            {
              text,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    };

    let lastError = "";
    for (let i = 0; i < modelCandidates.length; i += 1) {
      const model = modelCandidates[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const errText = !response.ok ? await response.text() : "";
      if (!response.ok) {
        lastError = errText || `${response.status}`;
        const tryNextModel =
          !configured &&
          i < modelCandidates.length - 1 &&
          (response.status >= 500 ||
            response.status === 429 ||
            response.status === 400 ||
            response.status === 404 ||
            response.status === 403);
        if (tryNextModel) continue;
        throw new InternalServerErrorException(`Gemini TTS failed (${model}): ${response.status} ${errText}`);
      }
      const json = await response.json();
      const base64 = extractAudioBase64(json);
      if (base64) {
        return { audioBase64: base64, encoding: "pcm16" };
      }
      lastError = "Gemini returned no TTS audio in response";
      if (!configured && i < modelCandidates.length - 1) continue;
      throw new InternalServerErrorException(lastError);
    }
    throw new InternalServerErrorException(lastError || "Gemini TTS failed");
  }
}
