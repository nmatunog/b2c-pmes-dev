import { useLayoutEffect } from "react";
import { CheckCircle2, IdCard, Mail, User } from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";

/**
 * Shown once after POST /pmes/full-profile succeeds: confirms official record, Member ID, and login email.
 */
export function MemberSubmissionAckScreen({
  displayName,
  email,
  memberIdNo,
  memberIdIsProvisional,
  alternatePublicHandle,
  onContinueToPortal,
}) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const id = String(memberIdNo || "").trim();
  const alt = String(alternatePublicHandle || "").trim();

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100/80 p-4 pb-28 pt-8 sm:p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <B2CLogo size="lg" align="center" className="mx-auto mb-4" />
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-950">
            <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-sm font-black uppercase tracking-wide">Official submission received</span>
          </div>
          <h1 className="mt-4 text-2xl font-black uppercase tracking-tight text-[#004aad] sm:text-3xl">
            Membership form on file
          </h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
            Your digital membership sheet was submitted successfully. The cooperative now has your official record. Below
            are your <span className="font-semibold text-slate-800">finalized Member ID</span> and the{" "}
            <span className="font-semibold text-slate-800">login email</span> (same as the name card on the upper left).
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirmed account</p>
          <ul className="mt-4 space-y-4">
            <li className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <User className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Signed in as</p>
                <p className="truncate text-base font-black text-slate-900">{displayName || "Member"}</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Mail className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Login email</p>
                <p className="break-all text-sm font-semibold text-slate-900">{email || "—"}</p>
              </div>
            </li>
            <li className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#004aad]/10 text-[#004aad]">
                <IdCard className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Member ID (finalized)</p>
                {id ? (
                  <p className="mt-0.5 font-mono text-base font-bold text-slate-900">{id}</p>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-slate-600">Assigned on the server — check again in a moment if empty.</p>
                )}
                {memberIdIsProvisional ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-950">
                    Provisional ID: your permanent cohort code is applied after your legal date of birth is confirmed on
                    file.
                  </p>
                ) : null}
                {alt ? (
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Alternate label: <span className="font-mono font-semibold text-slate-800">{alt}</span>
                  </p>
                ) : null}
              </div>
            </li>
          </ul>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onContinueToPortal}
            className="btn-primary inline-flex w-full max-w-md items-center justify-center gap-2 py-4 text-base font-black sm:w-auto sm:min-w-[280px]"
          >
            Continue to member portal
          </button>
          <p className="mt-3 text-xs font-medium text-slate-500">Opens your member home — tools, profile, and certificate access.</p>
        </div>
      </div>
    </div>
  );
}
