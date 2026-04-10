import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TtsDto } from "./dto/tts.dto";
import { GeminiTtsProvider } from "./providers/gemini-tts.provider";
import { NoopTtsProvider } from "./providers/noop-tts.provider";
import type { TtsSynthesisResult } from "./interfaces/tts-provider.interface";

const DEFAULT_VOICE = "Aoede";
const CACHE_MAX = 64;

@Injectable()
export class AiService {
  private readonly cache = new Map<string, TtsSynthesisResult>();

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiTtsProvider,
    private readonly noop: NoopTtsProvider,
  ) {}

  async synthesizeTts(dto: TtsDto): Promise<TtsSynthesisResult> {
    const voice = dto.voice?.trim() || DEFAULT_VOICE;
    const provider = this.resolveProvider();
    const key = this.cacheKey(dto.text, voice);
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

  private resolveProvider() {
    const id = (this.config.get<string>("AI_PROVIDER") ?? "gemini").toLowerCase();
    if (id === "noop") return this.noop;
    return this.gemini;
  }

  private cacheKey(text: string, voice: string): string {
    return createHash("sha256").update(`${voice}|${text}`).digest("hex");
  }
}
