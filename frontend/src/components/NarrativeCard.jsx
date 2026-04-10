import { useEffect } from "react";
import { ChevronDown, LayoutList, Loader2, Volume2, Zap } from "lucide-react";
import { KaUbanGuide } from "./KaUbanGuide";

/** Turn module outline strings into lists and paragraphs for scanability and lower cognitive load. */
function OutlineBody({ outline }) {
  const rawLines = outline.split("\n");
  const chunks = [];
  let bulletBuf = [];

  const flushBullets = () => {
    if (bulletBuf.length === 0) return;
    chunks.push({ kind: "bullets", items: [...bulletBuf] });
    bulletBuf = [];
  };

  for (const line of rawLines) {
    const t = line.trim();
    const bulletMatch = t.match(/^[•\-\*]\s*(.+)$/);
    if (bulletMatch) {
      bulletBuf.push(bulletMatch[1]);
      continue;
    }
    flushBullets();
    if (!t) continue;
    const numMatch = t.match(/^(\d+)\.\s*(.+)$/);
    if (numMatch) {
      chunks.push({ kind: "ordered", n: numMatch[1], text: numMatch[2] });
    } else {
      chunks.push({ kind: "text", text: t });
    }
  }
  flushBullets();

  return (
    <div className="space-y-5">
      {chunks.map((chunk, i) => {
        if (chunk.kind === "bullets") {
          return (
            <ul key={i} className="list-none space-y-3.5 border-l-2 border-[#004aad]/25 pl-5">
              {chunk.items.map((text, j) => (
                <li key={j} className="text-[1.0625rem] font-normal leading-relaxed text-slate-700 md:text-lg">
                  {text}
                </li>
              ))}
            </ul>
          );
        }
        if (chunk.kind === "ordered") {
          return (
            <div
              key={i}
              className="flex gap-3 text-[1.0625rem] font-normal leading-relaxed text-slate-700 md:text-lg"
            >
              <span className="mt-0.5 min-w-[2rem] font-semibold tabular-nums text-[#004aad]" aria-hidden>
                {chunk.n}.
              </span>
              <span>{chunk.text}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-[1.0625rem] font-medium leading-relaxed text-slate-800 md:text-lg">
            {chunk.text}
          </p>
        );
      })}
    </div>
  );
}

export function NarrativeCard({
  title,
  outline,
  isOpen,
  onClick,
  index,
  script,
  courseAudioEnabled,
  prefetchTts,
  playTts,
  isSpeaking,
  audioLoading,
  illustration,
}) {
  const panelId = `narrative-panel-${index}`;
  const headerId = `narrative-header-${index}`;
  const ttsKey = `${index}-${title}`;

  /** Prefetch TTS only when voice mode is on. */
  useEffect(() => {
    if (!courseAudioEnabled || !isOpen || !script?.trim() || !prefetchTts) return;
    prefetchTts(script, ttsKey);
  }, [courseAudioEnabled, isOpen, script, prefetchTts, ttsKey]);

  return (
    <div
      className={`mb-5 overflow-hidden rounded-3xl border-2 transition-all duration-300 md:rounded-[2rem] ${
        isOpen
          ? "border-[#004aad] bg-white shadow-[0_12px_40px_-12px_rgba(0,74,173,0.25)]"
          : "border-slate-200/90 bg-slate-50/80 hover:border-[#004aad]/35 hover:bg-white"
      }`}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onClick}
        className="flex w-full items-start justify-between gap-4 p-5 text-left md:items-center md:p-7"
      >
        <span className="flex min-w-0 flex-1 items-start gap-4 md:items-center md:gap-5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold md:h-12 md:w-12 md:text-base ${
              isOpen
                ? "bg-[#004aad] text-white shadow-md shadow-[#004aad]/30"
                : "border-2 border-slate-200 bg-white text-slate-500"
            }`}
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="min-w-0">
            <span
              className={`block text-lg font-bold leading-snug tracking-tight md:text-xl ${
                isOpen ? "text-[#004aad]" : "text-slate-800"
              }`}
            >
              {title}
            </span>
            <span className="mt-1 block text-sm font-medium text-slate-500">
              {isOpen
                ? "Tap to collapse"
                : courseAudioEnabled
                  ? "Tap to read key points & listen"
                  : "Tap to read key points (text guide beside slide)"}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`mt-1 h-6 w-6 shrink-0 transition-transform duration-300 md:h-7 md:w-7 ${
            isOpen ? "rotate-180 text-[#004aad]" : "text-slate-400"
          }`}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={`transition-all duration-300 ease-out ${
          isOpen ? "max-h-[8000px] opacity-100" : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="border-t border-slate-100 bg-white px-5 pb-6 pt-2 md:px-8 md:pb-8">
          <div
            className={
              !courseAudioEnabled && isOpen
                ? "lg:grid lg:grid-cols-12 lg:items-start lg:gap-6"
                : ""
            }
          >
            <div className={!courseAudioEnabled && isOpen ? "lg:col-span-7" : ""}>
              {illustration?.src ? (
                <figure
                  className={`mb-5 overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm ${
                    illustration.philippinesDisplay
                      ? "bg-[#002654] px-6 py-8 md:px-10 md:py-10"
                      : "bg-slate-50 px-6 py-6"
                  }`}
                >
                  <img
                    src={illustration.src}
                    alt={illustration.alt ?? ""}
                    className={`mx-auto h-auto max-h-[min(8rem,22vw)] w-auto max-w-full object-contain md:max-h-36 ${
                      illustration.philippinesDisplay ? "brightness-0 invert" : ""
                    }`}
                    loading="lazy"
                    decoding="async"
                  />
                  {illustration.philippinesDisplay ? (
                    <figcaption className="mt-4 text-center text-xs font-medium leading-snug text-white/85">
                      Official Philippines display: white symbol on dark blue (international Co-op identity scheme).
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
              <div className="rounded-2xl bg-gradient-to-b from-[#004aad]/[0.06] to-slate-50/80 p-5 md:p-7">
                <div className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]/90 md:text-sm">
                  <LayoutList className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2.5} aria-hidden />
                  <span>Key points</span>
                </div>
                <OutlineBody outline={outline} />
              </div>
            </div>

            {!courseAudioEnabled && isOpen ? (
              <div className="mt-6 min-w-0 lg:col-span-5 lg:mt-0">
                <div className="lg:sticky lg:top-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your guide (no sound)
                  </p>
                  <KaUbanGuide key={ttsKey} script={script} active={isOpen} />
                </div>
              </div>
            ) : null}
          </div>

          {courseAudioEnabled ? (
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  playTts(script, ttsKey);
                }}
                disabled={isSpeaking || audioLoading}
                aria-busy={audioLoading}
                className={`flex min-h-[3.25rem] w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-semibold tracking-wide transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004aad] md:w-auto md:min-w-[min(100%,20rem)] md:px-8 md:text-lg ${
                  isSpeaking
                    ? "animate-pulse bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                    : audioLoading
                      ? "cursor-wait bg-sky-50 text-sky-900 ring-1 ring-sky-200"
                      : "bg-[#004aad] text-white shadow-lg shadow-[#004aad]/25 hover:bg-[#003d99] active:scale-[0.99]"
                } disabled:opacity-60`}
              >
                {isSpeaking ? (
                  <Zap className="h-5 w-5 shrink-0 animate-pulse" aria-hidden />
                ) : audioLoading ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Volume2 className="h-5 w-5 shrink-0" aria-hidden />
                )}
                <span>
                  {isSpeaking
                    ? "Ka-uban is speaking…"
                    : audioLoading
                      ? "Getting voice ready…"
                      : "Hear from Ka-uban"}
                </span>
              </button>
              <p className="text-center text-xs text-slate-500 md:text-left">
                First play may take a few seconds; replay is instant. Audio loads in the background when you open a section.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
