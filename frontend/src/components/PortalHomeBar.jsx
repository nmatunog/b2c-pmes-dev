import { House } from "lucide-react";

/**
 * Fixed control to return to the marketing homepage from any PMES / portal screen.
 */
export function PortalHomeBar({ onGoHome }) {
  return (
    <nav
      className="fixed right-4 top-4 z-[100] sm:right-6 sm:top-5"
      aria-label="Site navigation"
    >
      <button
        type="button"
        onClick={onGoHome}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[#004aad] shadow-lg shadow-slate-900/10 backdrop-blur-md transition hover:border-[#004aad]/40 hover:bg-[#004aad] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004aad]"
      >
        <House className="h-5 w-5 shrink-0" aria-hidden />
        Home
      </button>
    </nav>
  );
}
