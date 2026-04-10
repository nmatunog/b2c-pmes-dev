import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { GeminiTtsProvider } from "./providers/gemini-tts.provider";
import { GrokTtsProvider } from "./providers/grok-tts.provider";
import { NoopTtsProvider } from "./providers/noop-tts.provider";
import { OpenaiTtsProvider } from "./providers/openai-tts.provider";

@Module({
  controllers: [AiController],
  providers: [AiService, GeminiTtsProvider, OpenaiTtsProvider, GrokTtsProvider, NoopTtsProvider],
})
export class AiModule {}
