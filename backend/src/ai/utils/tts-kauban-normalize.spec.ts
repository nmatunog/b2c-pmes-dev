import { normalizeKaubanForTts } from "./tts-kauban-normalize";

describe("normalizeKaubanForTts", () => {
  it("rewrites Ka-uban / Kauban variants to ka-ooban spelling for TTS", () => {
    expect(normalizeKaubanForTts("Meet Ka-uban today.")).toBe(
      "Meet Ka-ooban today.",
    );
    expect(normalizeKaubanForTts("ka-uban says hello")).toBe(
      "ka-ooban says hello",
    );
    expect(normalizeKaubanForTts("Kauban is here")).toBe("Ka-ooban is here");
    expect(normalizeKaubanForTts("Use kauban now")).toBe("Use ka-ooban now");
    expect(normalizeKaubanForTts("KA-UBAN")).toBe("KA-OOBAN");
  });

  it("handles possessive", () => {
    expect(normalizeKaubanForTts("Ka-uban's guide")).toBe("Ka-ooban's guide");
    expect(normalizeKaubanForTts("Kauban's tips")).toBe("Ka-ooban's tips");
  });

  it("leaves unrelated text unchanged", () => {
    expect(normalizeKaubanForTts("")).toBe("");
    expect(normalizeKaubanForTts("No name here.")).toBe("No name here.");
  });
});
