import { useCallback, useEffect, useId, useState } from "react";
import { FileText, X } from "lucide-react";
import { parseBylawsToSegments } from "./parseBylawsText.js";

async function extractTextFromPdfUrl(url) {
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url").then((m) => m.default),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load document (${res.status})`);
  const buf = await res.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const parts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    parts.push(line.trim());
  }
  return parts.join("\n\n");
}

/**
 * @param {{ active: boolean; onClose: () => void; pdfUrl: string }} props
 */
export function BylawsModal({ active, onClose, pdfUrl }) {
  const baseId = useId();
  const [phase, setPhase] = useState("idle");
  const [segments, setSegments] = useState(/** @type {ReturnType<typeof parseBylawsToSegments>} */ ([]));
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));

  const runExtract = useCallback(async () => {
    setPhase("loading");
    setLoadError(null);
    try {
      const raw = await extractTextFromPdfUrl(pdfUrl);
      setSegments(parseBylawsToSegments(raw));
      setPhase("ready");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load by-laws.");
      setPhase("error");
    }
  }, [pdfUrl]);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }
    runExtract();
  }, [active, runExtract]);

  const tocEntries = segments
    .map((s, i) => (s.type === "h2" ? { text: s.text, anchorId: `bylaw-h2-${i}` } : null))
    .filter(Boolean);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[251] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={`${baseId}-title`}
        className="animate-in zoom-in-95 duration-200 relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[32px]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 shadow-md ring-1 ring-slate-200/80 transition-colors hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <header className="shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 pb-5 pt-6 pr-14 sm:px-8 sm:pt-8">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 id={`${baseId}-title`} className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
                By-Laws (Primary)
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                Adopted and signed <span className="font-bold text-slate-800">October 2023</span>.{" "}
                <span className="font-bold text-slate-800">Signed by the Cooperators.</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                The text below is extracted from the official PDF for easier reading.{" "}
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">
                  Open original PDF
                </a>
                .
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-slate-50/90">
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" aria-hidden />
              <p className="text-sm font-semibold text-slate-600">Loading and extracting text…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4 px-5 py-8 sm:px-8">
              <p className="text-sm font-medium text-slate-700">{loadError}</p>
              <p className="text-sm text-slate-600">
                Add the file to <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs">frontend/public/documents/b2c-bylaws-primary.pdf</code>{" "}
                or open the document directly.
              </p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700"
              >
                Open PDF
              </a>
            </div>
          )}

          {phase === "ready" && segments.length > 0 && (
            <div className="flex min-h-0 flex-col gap-0 lg:flex-row">
              {tocEntries.length > 1 && (
                <nav
                  aria-label="By-laws sections"
                  className="max-h-[28vh] shrink-0 overflow-y-auto border-b border-slate-200/80 bg-white px-5 py-4 lg:max-h-none lg:w-[min(260px,34%)] lg:border-b-0 lg:border-r lg:py-6"
                >
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-blue-600">Contents</p>
                  <ul className="space-y-2 text-left text-xs font-semibold leading-snug text-slate-600">
                    {tocEntries.map((item) => (
                      <li key={item.anchorId}>
                        <a
                          href={`#${item.anchorId}`}
                          className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 hover:text-blue-700"
                        >
                          {item.text.length > 72 ? `${item.text.slice(0, 70)}…` : item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <div
                id="bylaws-scroll"
                className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 lg:max-h-[min(68vh,720px)]"
              >
                <article className="mx-auto max-w-3xl">
                  {segments.map((seg, i) => {
                    const key = `${seg.type}-${i}-${seg.text.slice(0, 24)}`;
                    if (seg.type === "h2") {
                      return (
                        <h3
                          key={key}
                          id={`bylaw-h2-${i}`}
                          className="scroll-mt-6 border-b border-slate-200 pb-2 text-lg font-black tracking-tight text-slate-900 first:mt-0 mt-10 sm:text-xl"
                        >
                          {seg.text}
                        </h3>
                      );
                    }
                    if (seg.type === "h3") {
                      return (
                        <h4 key={key} className="mt-6 text-base font-bold text-slate-800 sm:text-lg">
                          {seg.text}
                        </h4>
                      );
                    }
                    return (
                      <p key={key} className="mt-3 text-[15px] leading-[1.7] text-slate-700 sm:text-base">
                        {seg.text}
                      </p>
                    );
                  })}
                </article>
              </div>
            </div>
          )}

          {phase === "ready" && segments.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-slate-600">
              No text could be parsed from the PDF. Try{" "}
              <a href={pdfUrl} className="font-bold text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                opening the PDF
              </a>{" "}
              instead.
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-xl sm:py-4"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
