/**
 * Server-proxied TTS — keeps Gemini keys off the client. Backend may use AI_PROVIDER=noop to avoid cost.
 */
const baseUrl = () => (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function requestTts({ text, voice = "Sadachbia" }, options = {}) {
  const maxAttempts = options.retries ?? 3;
  const base = baseUrl();
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not set (point it at your Nest API, e.g. http://localhost:3000)");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${base}/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });

    if (response.ok) {
      return response.json();
    }

    const detail = await response.text();
    const err = new Error(detail || `TTS failed (${response.status})`);
    const retryable = response.status >= 500 || response.status === 429;

    if (!retryable || attempt === maxAttempts) {
      throw err;
    }
    await sleep(250 * attempt);
  }

  throw new Error("TTS request failed");
}
