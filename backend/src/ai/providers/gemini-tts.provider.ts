import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TtsProvider, TtsSynthesisResult } from "../interfaces/tts-provider.interface";

/** Google Gemini TTS — swap model via GEMINI_TTS_MODEL without code changes. */
@Injectable()
export class GeminiTtsProvider implements TtsProvider {
  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, voice: string): Promise<TtsSynthesisResult> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      throw new InternalServerErrorException("GEMINI_API_KEY is not configured");
    }
    const model =
      this.config.get<string>("GEMINI_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: `Speak as Ka-uban. Script: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new InternalServerErrorException(`Gemini TTS failed: ${response.status} ${errText}`);
    }
    const result = (await response.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
    };
    const base64 = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) {
      throw new InternalServerErrorException("Gemini returned no TTS audio");
    }
    return { audioBase64: base64, encoding: "pcm16" };
  }
}
