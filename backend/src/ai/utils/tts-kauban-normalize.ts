/**
 * VO should pronounce the guide name as three syllables: ka–ooban (spelled "ka-ooban" for engines).
 * Applied to all TTS providers before synthesis and cache keying.
 */
export function normalizeKaubanForTts(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text;
  return text
    .replace(/\bKa-uban's\b/g, "Ka-ooban's")
    .replace(/\bka-uban's\b/g, "ka-ooban's")
    .replace(/\bKa-uban\b/g, "Ka-ooban")
    .replace(/\bka-uban\b/g, "ka-ooban")
    .replace(/\bKA-UBAN\b/g, "KA-OOBAN")
    .replace(/\bKauban's\b/g, "Ka-ooban's")
    .replace(/\bkauban's\b/g, "ka-ooban's")
    .replace(/\bKauban\b/g, "Ka-ooban")
    .replace(/\bkauban\b/g, "ka-ooban");
}
