/**
 * Server-proxied TTS — keeps Gemini keys off the client. Backend may use AI_PROVIDER=noop to avoid cost.
 */
const baseUrl = () => (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function requestTts({ text, voice = "Aoede" }) {
  const base = baseUrl();
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not set (point it at your Nest API, e.g. http://localhost:3000)");
  }
  const response = await fetch(`${base}/ai/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `TTS failed (${response.status})`);
  }
  return response.json();
}
