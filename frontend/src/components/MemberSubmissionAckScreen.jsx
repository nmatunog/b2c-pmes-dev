import { useLayoutEffect } from "react";
import { CheckCircle2, IdCard, Mail, Sparkles, User } from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";

/**
 * Shown once after POST /pmes/full-profile succeeds: confirms official record, Member ID, callsign, and emails.
 */
export function MemberSubmissionAckScreen({
  displayName,
  /** Firebase sign-in address (may be import/synthetic). */
  loginEmail,
  /** Email on the submitted membership form for cooperative notices. */
  officialContactEmail,
  /** Server-normalized callsign when set. */
  callsign,
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
  const cs = String(callsign || "").trim();
  const official = String(officialContactEmail || "").trim();
  const login = String(loginEmail || "").trim();
  const showTwoEmails = official && login && official.toLowerCase() !== login.toLowerCase();

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
            Your digital membership sheet was submitted successfully. Below are your{" "}
            <span className="font-semibold text-slate-800">Member ID</span>,{" "}
            <span className="font-semibold text-slate-800">callsign</span> (if set), and the emails on record.
          </p>
        </div>

        {cs ? (
          <div className="rounded-2xl border-2 border-[#004aad]/30 bg-gradient-to-br from-[#004aad]/10 to-white p-6 text-center shadow-md">
            <div className="inline-flex items-center justify-center gap-2 text-[#004aad]">
              <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Your callsign</span>
            </div>
            <p className="mt-3 font-mono text-3xl font-black tracking-tight text-[#004aad] sm:text-4xl">{cs}</p>
            <p className="mt-2 text-xs font-medium text-slate-600">
              Shown on your name card and used as your public alternate label with your Member ID.
            </p>
          </div>
        ) : null}

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

            <li className="flex gap-3 border-t border-slate-100 pt-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <Mail className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Official contact email</p>
                <p className="break-all text-sm font-bold text-slate-900">{official || "—"}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  This is the address from your membership form — used for cooperative notices and mailings.
                </p>
              </div>
            </li>

            {showTwoEmails ? (
              <li className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account login email (Firebase)</p>
                  <p className="break-all text-sm font-semibold text-slate-800">{login}</p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Used only to sign in to this app. It does not change when you set a different contact email on the form.
                  </p>
                </div>
              </li>
            ) : null}

            <li className="flex gap-3 border-t border-slate-100 pt-4">
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

        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-left">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Changing your email later</p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm font-medium text-slate-700">
            <li>
              <span className="font-semibold text-slate-900">Notices / cooperative mail:</span> update the email on your
              membership record — contact the membership desk or use any future &quot;profile&quot; update flow the coop
              provides.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Sign-in address (Firebase):</span> changing it means moving your
              account; use Firebase &quot;change email&quot; in your account settings if available, or ask support so your
              Postgres row and login stay aligned.
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
