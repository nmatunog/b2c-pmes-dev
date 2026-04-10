/** Provider-agnostic TTS result (Gemini PCM today; same shape if another backend is added). */
export interface TtsSynthesisResult {
  audioBase64: string;
}

export interface TtsProvider {
  synthesize(text: string, voice: string): Promise<TtsSynthesisResult>;
}
