import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { TtsProvider, TtsSynthesisResult } from "../interfaces/tts-provider.interface";

/** Zero API cost — use for local dev or when Gemini quota/cost should be avoided. */
@Injectable()
export class NoopTtsProvider implements TtsProvider {
  async synthesize(): Promise<TtsSynthesisResult> {
    throw new ServiceUnavailableException(
      "TTS is disabled (AI_PROVIDER=noop). Set AI_PROVIDER=gemini and GEMINI_API_KEY to enable speech.",
    );
  }
}
