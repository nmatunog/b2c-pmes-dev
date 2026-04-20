import { Briefcase, User } from "lucide-react";

/**
 * @param {{ fullName: string, email: string, callsign?: string, positionLabel?: string, ribbonStatus?: 'full' | 'pending' | 'prospect' } | null} member
 * @param {{ email: string, role?: string } | null} staff
 * @param {'fixed' | 'inline'} [memberLayout] — `inline` = in-flow strip (e.g. member portal); default fixed top-left.
 */
export function IdentityBanner({ member, staff, memberLayout = "fixed" }) {
  if (staff?.email) {
    const roleLabel = staff.role === "superuser" ? "Superuser" : "Admin";
    return (
      <div
        className="animate-in fade-in slide-in-from-left-2 fixed left-4 top-20 z-[90] max-w-sm rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur-md duration-300"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#004aad]/10 text-[#004aad]">
            <Briefcase className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Staff signed in</p>
            <p className="truncate text-sm font-black text-slate-900">{roleLabel}</p>
            <p className="truncate text-xs font-medium text-slate-600">{staff.email}</p>
          </div>
        </div>
      </div>
    );
  }

  if (member?.email) {
    const displayName = String(member.fullName || "").trim() || "Member";
    const callsign = String(member.callsign || "").trim();
    const positionLabel = String(member.positionLabel || "").trim();
    const status = member.ribbonStatus || "prospect";
    const badge =
      status === "full" ? (
        <span className="mt-1 inline-flex max-w-full shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-900 sm:mt-0">
          Full member
        </span>
      ) : status === "pending" ? (
        <span className="mt-1 inline-flex max-w-full shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 sm:mt-0">
          Pending member
        </span>
      ) : (
        <span className="mt-1 inline-flex max-w-full shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600 sm:mt-0">
          Potential
        </span>
      );

    if (memberLayout === "inline") {
      return (
        <div
          className="animate-in fade-in slide-in-from-top-1 w-full rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-md duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <User className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signed in as</p>
                <p className="truncate text-sm font-black text-slate-900">{displayName}</p>
                <span className="hidden sm:inline">{badge}</span>
              </div>
              <span className="sm:hidden">{badge}</span>
              {positionLabel ? (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Position: <span className="text-slate-800">{positionLabel}</span>
                </p>
              ) : null}
              {callsign ? (
                <div className="mt-2 rounded-xl border-2 border-[#004aad]/25 bg-[#004aad]/5 px-3 py-2 text-center sm:mt-2 sm:text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#004aad]/80">Callsign</p>
                  <p className="font-mono text-base font-black leading-tight tracking-tight text-[#004aad] sm:text-lg">{callsign}</p>
                </div>
              ) : null}
              <p className="mt-1 truncate text-xs font-medium text-slate-600">{member.email}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="animate-in fade-in slide-in-from-left-2 fixed left-4 top-20 z-[90] max-w-sm rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur-md duration-300"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <User className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signed in as</p>
            <p className="truncate text-sm font-black text-slate-900">{displayName}</p>
            {positionLabel ? (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Position: <span className="text-slate-800">{positionLabel}</span>
              </p>
            ) : null}
            {callsign ? (
              <div className="mt-2 rounded-xl border-2 border-[#004aad]/25 bg-[#004aad]/5 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#004aad]/80">Callsign</p>
                <p className="font-mono text-lg font-black leading-tight tracking-tight text-[#004aad]">{callsign}</p>
              </div>
            ) : null}
            <p className="truncate text-xs font-medium text-slate-600">{member.email}</p>
            {badge}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
