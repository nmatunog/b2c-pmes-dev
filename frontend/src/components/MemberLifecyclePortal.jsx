import { useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Lock,
  Send,
  Wallet,
} from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";

const TEMPLATE_URL = "/templates/member-full-profile-template.csv";

/**
 * Cooperative onboarding home: one screen explains the current gate and primary action.
 * Full member portal (referrals, etc.) only after stage FULL_MEMBER in the API.
 */
export function MemberLifecyclePortal({
  lifecycle,
  displayName,
  email,
  loading,
  apiConfigured,
  onContinuePmes,
  onOpenLoi,
  onOpenPayment,
  onSubmitFullProfile,
}) {
  const stage = lifecycle?.stage ?? "UNKNOWN";
  const [fullFields, setFullFields] = useState({
    tin: "",
    emergencyName: "",
    emergencyPhone: "",
    employerFull: "",
    notes: "",
  });
  const [sheetFile, setSheetFile] = useState(/** @type {File | null} */ (null));
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const firstName = String(displayName || "Member").trim().split(/\s+/)[0] || "Member";

  const handleFullSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!onSubmitFullProfile) return;
    setSubmitting(true);
    try {
      await onSubmitFullProfile({
        fields: fullFields,
        sheetFileName: sheetFile ? sheetFile.name : "",
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#004aad]" aria-hidden />
        <p className="text-sm font-semibold text-slate-600">Checking your membership status…</p>
      </div>
    );
  }

  if (!apiConfigured) {
    return (
      <div className="card-senior max-w-2xl space-y-4 border-amber-200 bg-amber-50/90 p-8 text-left">
        <div className="flex gap-3">
          <AlertCircle className="h-8 w-8 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="font-black text-amber-950">Membership pipeline needs the API</p>
            <p className="mt-2 text-sm font-medium text-amber-900">
              Set <code className="rounded bg-white/80 px-1">VITE_API_BASE_URL</code> so treasury and Board steps can be recorded. Until then, cooperative membership gates are not enforced.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-8">
      <div className="text-center">
        <B2CLogo size="lg" align="center" className="mb-4" />
        <h1 className="text-3xl font-black uppercase tracking-tighter text-[#004aad] sm:text-4xl">Member onboarding</h1>
        <p className="mt-3 text-base font-semibold text-slate-600">
          Hi {firstName}, your cooperative membership follows Board-approved steps after PMES.
        </p>
      </div>

      {stage === "PMES_NOT_PASSED" || stage === "NO_PARTICIPANT" ? (
        <section className="card-senior space-y-6 p-8 text-left">
          <div className="flex items-start gap-3">
            <ClipboardList className="h-10 w-10 shrink-0 text-[#004aad]" aria-hidden />
            <div>
              <h2 className="text-xl font-black text-slate-900">Complete PMES first</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                We don&apos;t have a passing PMES record for <span className="font-bold">{email}</span> yet. Finish the seminar and exam, then return here for LOI and payments.
              </p>
              <button type="button" onClick={onContinuePmes} className="btn-primary mt-6 w-full sm:w-auto">
                Continue PMES
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "AWAITING_LOI" ? (
        <section className="card-senior space-y-6 border-emerald-200/80 bg-emerald-50/40 p-8 text-left">
          <div className="flex items-start gap-3">
            <Send className="h-10 w-10 shrink-0 text-emerald-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-slate-900">Letter of Intent</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                Submit your LOI so the membership committee can process your application. You can update it until fees are posted.
              </p>
              <button type="button" onClick={onOpenLoi} className="btn-primary mt-6 w-full sm:w-auto">
                Open LOI form
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "AWAITING_PAYMENT" ? (
        <section className="card-senior space-y-6 border-amber-200/80 bg-amber-50/50 p-8 text-left">
          <div className="flex items-start gap-3">
            <Wallet className="h-10 w-10 shrink-0 text-amber-800" aria-hidden />
            <div>
              <h2 className="text-xl font-black text-slate-900">Share capital &amp; membership fees</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                Treasury will confirm payment before your file goes to the Board. Use the payment instructions on the next screen.
              </p>
              <button type="button" onClick={onOpenPayment} className="btn-primary mt-6 w-full sm:w-auto">
                Open payment information
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "PENDING_BOARD" ? (
        <section className="card-senior space-y-4 border-slate-200 bg-slate-50/90 p-8 text-left">
          <div className="flex items-start gap-3">
            <Building2 className="h-10 w-10 shrink-0 text-[#004aad]" aria-hidden />
            <div>
              <h2 className="text-xl font-black text-slate-900">Pending Board approval</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                Your payment is recorded. The Board reviews new members on a set schedule. You&apos;ll receive email when your status changes — no action needed here.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "AWAITING_FULL_PROFILE" ? (
        <section className="card-senior space-y-6 p-8 text-left">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <h2 className="text-xl font-black text-slate-900">Board approved — complete your full profile</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                Download the official CSV template, fill it in, then upload the file here and confirm the fields below. Staff may contact you if anything is unclear.
              </p>
              <a
                href={TEMPLATE_URL}
                download
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#004aad] underline-offset-2 hover:underline"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
                Download profile template (CSV)
              </a>
            </div>
          </div>

          <form onSubmit={handleFullSubmit} className="space-y-4 border-t border-slate-100 pt-6">
            {localError ? (
              <div className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">{localError}</div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                TIN (if applicable)
                <input
                  className="input-field mt-1"
                  value={fullFields.tin}
                  onChange={(e) => setFullFields((f) => ({ ...f, tin: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                Emergency contact name
                <input
                  className="input-field mt-1"
                  value={fullFields.emergencyName}
                  onChange={(e) => setFullFields((f) => ({ ...f, emergencyName: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                Emergency contact phone
                <input
                  className="input-field mt-1"
                  inputMode="tel"
                  value={fullFields.emergencyPhone}
                  onChange={(e) => setFullFields((f) => ({ ...f, emergencyPhone: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                Employer (full)
                <input
                  className="input-field mt-1"
                  value={fullFields.employerFull}
                  onChange={(e) => setFullFields((f) => ({ ...f, employerFull: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              Notes for membership desk
              <textarea
                className="input-field mt-1 min-h-[5rem]"
                rows={3}
                value={fullFields.notes}
                onChange={(e) => setFullFields((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Upload completed sheet</p>
              <input
                type="file"
                accept=".csv,.txt"
                className="mt-2 block w-full text-sm font-medium text-slate-700"
                onChange={(e) => setSheetFile(e.target.files?.[0] ?? null)}
              />
              {sheetFile ? (
                <p className="mt-2 text-xs font-medium text-slate-500">Selected: {sheetFile.name}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-400">CSV from the template is preferred.</p>
              )}
            </div>
            <button type="submit" disabled={submitting} className="btn-primary flex w-full items-center justify-center gap-2 py-4 sm:w-auto">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
              Submit full profile
            </button>
          </form>
        </section>
      ) : null}

      {stage === "UNKNOWN" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-950">
          Could not load membership status. Try again from Home, or contact support if this persists.
        </div>
      ) : null}
    </div>
  );
}
