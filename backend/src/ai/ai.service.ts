import { createHash } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TtsDto } from "./dto/tts.dto";
import { GeminiTtsProvider } from "./providers/gemini-tts.provider";
import { GrokTtsProvider } from "./providers/grok-tts.provider";
import { NoopTtsProvider } from "./providers/noop-tts.provider";
import { OpenaiTtsProvider } from "./providers/openai-tts.provider";
import type { TtsSynthesisResult } from "./interfaces/tts-provider.interface";

/** Gemini: Sadachbia = lively (see Google prebuilt TTS voice list). */
const DEFAULT_VOICE = "Sadachbia";
const CACHE_MAX = 64;
/** Bump when synthesis behavior changes (e.g. prompt text) so old cached audio is not reused. */
const TTS_CACHE_VERSION = 2;

@Injectable()
export class AiService {
  private readonly cache = new Map<string, TtsSynthesisResult>();

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiTtsProvider,
    private readonly openai: OpenaiTtsProvider,
    private readonly grok: GrokTtsProvider,
    private readonly noop: NoopTtsProvider,
  ) {}

  async synthesizeTts(dto: TtsDto): Promise<TtsSynthesisResult> {
    const voice = dto.voice?.trim() || DEFAULT_VOICE;
    const providerId = this.providerId();
    const provider = this.resolveProvider(providerId);
    const key = this.cacheKey(providerId, dto.text, voice);
    const hit = this.cache.get(key);
    if (hit) return hit;

    const out = await provider.synthesize(dto.text, voice);
    if (this.cache.size >= CACHE_MAX) {
      const first = this.cache.keys().next().value as string;
      this.cache.delete(first);
    }
    this.cache.set(key, out);
    return out;
  }

  private providerId(): string {
    return (this.config.get<string>("AI_PROVIDER") ?? "noop").toLowerCase();
  }

  private resolveProvider(id: string) {
    switch (id) {
      case "noop":
        return this.noop;
      case "gemini":
        return this.gemini;
      case "openai":
        return this.openai;
      case "grok":
        return this.grok;
      default:
        throw new BadRequestException(
          `Unknown AI_PROVIDER="${id}". Use: noop, gemini, openai, grok.`,
        );
    }
  }

  private cacheKey(providerId: string, text: string, voice: string): string {
    return createHash("sha256")
      .update(`${TTS_CACHE_VERSION}|${providerId}|${voice}|${text}`)
      .digest("hex");
  }
}
