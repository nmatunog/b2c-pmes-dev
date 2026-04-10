import { MessageCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTypewriter } from "../hooks/useTypewriter";
import { KaubanAvatarHead, KaubanSpeechTail } from "./KaubanAvatarHead";

/**
 * Avatar + tail sit fully above the card (`-translate-y-full`) so the tail is never covered by the white panel.
 */
function KaUbanAvatarWithTail({ animating }) {
  return (
    <div
      className={`pointer-events-none absolute right-2 top-0 z-30 flex -translate-y-[calc(100%+6px)] flex-col items-center sm:right-4 ${
        animating ? "animate-[pulse_2s_ease-in-out_infinite]" : ""
      }`}
      aria-hidden
    >
      <KaubanAvatarHead sizeClass="h-9 w-9 sm:h-10 sm:w-10" />
      <KaubanSpeechTail className="mt-0.5 h-4 w-12 sm:h-[18px] sm:w-14" />
    </div>
  );
}

/**
 * Text-only guide: avatar + tail outside the card + typewriter script (does not use TTS).
 */
export function KaUbanGuide({ script, active }) {
  const [replayKey, setReplayKey] = useState(0);
  const { shown, done } = useTypewriter(script ?? "", active, replayKey, 13);

  return (
    <div className="relative min-w-0 w-full pt-[3.35rem] sm:pt-[3.15rem]">
      <div className="relative rounded-3xl border-2 border-[#004aad]/20 bg-white p-4 shadow-[0_8px_30px_-8px_rgba(0,74,173,0.2)] sm:p-5 md:p-6">
        <KaUbanAvatarWithTail animating={active && !done} />
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#004aad]">
          <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          <span>Ka-uban says</span>
        </div>
        <p className="min-h-[4.5rem] text-[1.05rem] leading-relaxed text-slate-800 md:text-lg" lang="en">
          {shown}
          {active && !done ? (
            <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-[#004aad]" aria-hidden />
          ) : null}
        </p>
        {done && script?.length > 0 ? (
          <button
            type="button"
            onClick={() => setReplayKey((k) => k + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Replay text
          </button>
        ) : null}
      </div>
    </div>
  );
}
