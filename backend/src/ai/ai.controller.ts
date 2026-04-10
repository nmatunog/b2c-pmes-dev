import { Body, Controller, Post } from "@nestjs/common";
import { AiService } from "./ai.service";
import { TtsDto } from "./dto/tts.dto";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Proxies TTS so the browser never holds GEMINI_API_KEY. Response matches prior client contract (PCM base64). */
  @Post("tts")
  async tts(@Body() body: TtsDto) {
    return this.ai.synthesizeTts(body);
  }
}
