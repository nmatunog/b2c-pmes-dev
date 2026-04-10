import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TtsProvider, TtsSynthesisResult } from "../interfaces/tts-provider.interface";

/** xAI Grok Text-to-Speech — https://docs.x.ai/docs/guides/text-to-speech */
const XAI_VOICES = new Set(["eve", "ara", "leo", "rex", "sal"]);

@Injectable()
export class GrokTtsProvider implements TtsProvider {
  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, voice: string): Promise<TtsSynthesisResult> {
    const apiKey = this.config.get<string>("XAI_API_KEY");
    if (!apiKey?.trim()) {
      throw new InternalServerErrorException("XAI_API_KEY is not configured");
    }
    const voiceId = XAI_VOICES.has(voice.toLowerCase()) ? voice.toLowerCase() : "ara";
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `Speak as Ka-uban. Script: ${text}`,
        voice_id: voiceId,
        language: "en",
        output_format: {
          codec: "mp3",
          sample_rate: 24000,
          bit_rate: 128000,
        },
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new InternalServerErrorException(`xAI Grok TTS failed: ${response.status} ${errText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      encoding: "mp3",
    };
  }
}
