import { useEffect, useState } from "react";

/**
 * Reveals `fullText` one character at a time while `active` is true.
 * `resetKey` changes restart the animation (e.g. Replay button).
 */
export function useTypewriter(fullText, active, resetKey = 0, charIntervalMs = 14) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active || !fullText?.length) {
      setShown("");
      setDone(false);
      return;
    }

    let cancelled = false;
    setShown("");
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      if (cancelled) return;
      i += 1;
      setShown(fullText.slice(0, i));
      if (i >= fullText.length) {
        setDone(true);
        window.clearInterval(id);
      }
    }, charIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, fullText, resetKey, charIntervalMs]);

  return { shown, done };
}
