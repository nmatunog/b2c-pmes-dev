/**
 * Wait until the browser can start playback without stalling (reduces silent gaps after fetch).
 */
export function preloadAudioUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "auto";
    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onErr);
    };
    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(audio);
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Audio failed to decode"));
    };
    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("error", onErr, { once: true });
    audio.src = url;
    if (audio.readyState >= 3) {
      queueMicrotask(onReady);
    } else {
      audio.load();
    }
  });
}

export function pcmToWav(pcmData, sampleRate = 24000) {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmData.length * 2, true);

  for (let i = 0; i < pcmData.length; i += 1) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
