import { useEffect, useId, useMemo } from "react";
import { FileText, X } from "lucide-react";
import { parsePrimaryBylawsPlaintext } from "./parsePrimaryBylaws.js";
import { PRIMARY_BYLAWS_PLAINTEXT } from "./b2cBylawsPrimarySource.js";

/**
 * @param {{ active: boolean; onClose: () => void; pdfUrl: string }} props
 */
function stripBylawHashFromUrl() {
  if (typeof window === "undefined") return;
  if (!/^#bylaw-h2-\d+$/i.test(window.location.hash)) return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

export function BylawsModal({ active, onClose, pdfUrl }) {
  const baseId = useId();

  const segments = useMemo(() => parsePrimaryBylawsPlaintext(PRIMARY_BYLAWS_PLAINTEXT), []);

  const tocEntries = useMemo(
    () =>
      segments
        .map((s, i) => (s.type === "h2" ? { text: s.text, anchorId: `bylaw-h2-${i}` } : null))
        .filter(Boolean),
    [segments],
  );

  useEffect(() => {
    if (active) stripBylawHashFromUrl();
  }, [active]);

  const handleClose = () => {
    stripBylawHashFromUrl();
    onClose();
  };

  const scrollToArticle = (anchorId) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[251] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={handleClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={`${baseId}-title`}
        className="animate-in zoom-in-95 duration-200 relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[32px]"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 shadow-md ring-1 ring-slate-200/80 transition-colors hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <header className="shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 pb-5 pt-6 pr-14 sm:px-8 sm:pt-8">
          <div className="mb-1 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Governance</p>
              <h2 id={`${baseId}-title`} className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
                By-Laws (Primary)
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                Adopted and signed <span className="font-bold text-slate-800">October 2023</span>.{" "}
                <span className="font-bold text-slate-800">Signed by the Cooperators.</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Full text below for reading on screen. The signature page with individual names is not shown here.{" "}
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">
                  Download official PDF
                </a>{" "}
                if needed.
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-[#f8fafc]">
          <div className="flex min-h-0 flex-col gap-0 lg:flex-row">
            {tocEntries.length > 1 && (
              <nav
                aria-label="By-laws articles"
                className="max-h-[30vh] shrink-0 overflow-y-auto border-b border-slate-200/90 bg-white px-5 py-4 shadow-sm lg:max-h-none lg:w-[min(280px,36%)] lg:border-b-0 lg:border-r lg:py-6 lg:shadow-none"
              >
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-blue-600">Articles</p>
                <ul className="space-y-1.5 text-left text-xs font-semibold leading-snug text-slate-600">
                  {tocEntries.map((item) => (
                    <li key={item.anchorId}>
                      <button
                        type="button"
                        onClick={() => scrollToArticle(item.anchorId)}
                        className="block w-full rounded-lg px-2 py-2 text-left text-inherit transition-colors hover:bg-slate-100 hover:text-blue-700"
                      >
                        {item.text.length > 80 ? `${item.text.slice(0, 78)}…` : item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div
              id="bylaws-scroll"
              className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-10 lg:max-h-[min(70vh,760px)]"
            >
              <article className="mx-auto max-w-3xl">
                {segments.map((seg, i) => {
                  const key = `${seg.type}-${i}-${seg.text.slice(0, 20)}`;
                  if (seg.type === "h1") {
                    return (
                      <h1
                        key={key}
                        className="border-b-2 border-blue-100 pb-4 text-center text-2xl font-black tracking-tight text-slate-900 sm:text-left sm:text-3xl"
                      >
                        {seg.text}
                      </h1>
                    );
                  }
                  if (seg.type === "h2") {
                    const afterH1 = segments[i - 1]?.type === "h1";
                    return (
                      <h2
                        key={key}
                        id={`bylaw-h2-${i}`}
                        className={`scroll-mt-6 border-b border-slate-200 pb-2 text-xl font-black tracking-tight text-blue-950 sm:text-2xl ${afterH1 ? "mt-8" : "mt-12"}`}
                      >
                        {seg.text}
                      </h2>
                    );
                  }
                  if (seg.type === "h3") {
                    return (
                      <h3
                        key={key}
                        className="mt-8 text-base font-bold leading-snug text-slate-900 sm:text-lg"
                      >
                        {seg.text}
                      </h3>
                    );
                  }
                  const afterH1 = segments[i - 1]?.type === "h1";
                  return (
                    <p
                      key={key}
                      className={`text-[15px] leading-[1.75] text-slate-700 sm:text-base ${afterH1 ? "mt-6 text-lg font-medium text-slate-800" : "mt-4"}`}
                    >
                      {seg.text}
                    </p>
                  );
                })}
              </article>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-xl sm:py-4"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
