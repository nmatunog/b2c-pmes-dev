/** PCM16 raw (Gemini); MP3 binary (OpenAI, xAI Grok TTS). */
export type TtsAudioEncoding = "pcm16" | "mp3";

export interface TtsSynthesisResult {
  audioBase64: string;
  encoding: TtsAudioEncoding;
}

export interface TtsProvider {
  synthesize(text: string, voice: string): Promise<TtsSynthesisResult>;
}
