import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TtsProvider, TtsSynthesisResult } from "../interfaces/tts-provider.interface";

const OPENAI_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

/** https://platform.openai.com/docs/api-reference/audio/createSpeech */
@Injectable()
export class OpenaiTtsProvider implements TtsProvider {
  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, voice: string): Promise<TtsSynthesisResult> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey?.trim()) {
      throw new InternalServerErrorException("OPENAI_API_KEY is not configured");
    }
    const model = this.config.get<string>("OPENAI_TTS_MODEL") ?? "tts-1";
    const mapped = OPENAI_VOICES.has(voice.toLowerCase()) ? voice.toLowerCase() : "nova";
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: `Speak as Ka-uban, warm and clear. Script: ${text}`,
        voice: mapped,
        response_format: "mp3",
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new InternalServerErrorException(`OpenAI TTS failed: ${response.status} ${errText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      encoding: "mp3",
    };
  }
}
