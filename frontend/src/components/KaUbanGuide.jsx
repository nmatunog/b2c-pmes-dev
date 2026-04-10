import { MessageCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTypewriter } from "../hooks/useTypewriter";

function TalkingHead({ animating }) {
  return (
    <div
      className={`relative flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#004aad] via-[#1e6fd4] to-[#38bdf8] shadow-lg ring-4 ring-white ${
        animating ? "animate-[pulse_2s_ease-in-out_infinite]" : ""
      }`}
      aria-hidden
    >
      <div className="absolute inset-2 rounded-full bg-white/10" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-inner">
        <div className="flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
        </div>
      </div>
      <svg className="absolute bottom-5 w-12 text-white/90" viewBox="0 0 48 16" fill="currentColor" aria-hidden>
        <path d="M8 0 Q24 14 40 0 Q44 4 40 8 Q24 18 8 8 Q4 4 8 0Z" />
      </svg>
      <span className="absolute bottom-1 text-[10px] font-bold uppercase tracking-wider text-white drop-shadow">
        Ka-uban
      </span>
    </div>
  );
}

/**
 * Text-only guide: avatar + speech bubble with typewriter script (does not use TTS).
 */
export function KaUbanGuide({ script, active }) {
  const [replayKey, setReplayKey] = useState(0);
  const { shown, done } = useTypewriter(script ?? "", active, replayKey, 13);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <TalkingHead animating={active && !done} />
      <div className="relative min-w-0 flex-1">
        <div className="absolute -left-1 top-6 hidden h-4 w-4 rotate-45 border-l-2 border-t-2 border-[#004aad]/25 bg-white sm:block" aria-hidden />
        <div className="relative rounded-3xl border-2 border-[#004aad]/20 bg-white p-4 shadow-[0_8px_30px_-8px_rgba(0,74,173,0.2)] md:p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#004aad]">
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} aria-hidden />
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
    </div>
  );
}
