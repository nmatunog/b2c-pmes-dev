import { Briefcase, User } from "lucide-react";

/**
 * Fixed top-left session ribbon: member (Firebase) shows full name + email; staff shows role + email.
 */
export function IdentityBanner({ member, staff }) {
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
            <p className="truncate text-xs font-medium text-slate-600">{member.email}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
