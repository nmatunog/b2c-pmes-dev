import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { GeminiTtsProvider } from "./providers/gemini-tts.provider";
import { NoopTtsProvider } from "./providers/noop-tts.provider";

@Module({
  controllers: [AiController],
  providers: [AiService, GeminiTtsProvider, NoopTtsProvider],
})
export class AiModule {}
