import { useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  Wallet,
} from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";
import { MemberFullProfileForm } from "./MemberFullProfileForm.jsx";

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
  /** True when this session has a passing PMES score or certificate (may be ahead of API sync). */
  clientPmesPassed = false,
  onViewCertificate,
  onContinuePmes,
  onOpenLoi,
  onOpenPayment,
  onSubmitFullProfile,
}) {
  const stage = lifecycle?.stage ?? "UNKNOWN";
  const legacyFounder = Boolean(lifecycle?.isLegacyFounderImport);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const firstName = String(displayName || "Member").trim().split(/\s+/)[0] || "Member";

  const handleFullSuccess = async (payload) => {
    setLocalError(null);
    if (!onSubmitFullProfile) return;
    setSubmitting(true);
    try {
      await onSubmitFullProfile(payload);
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
    <div className="w-full max-w-4xl space-y-8">
      <div className="text-center">
        <B2CLogo size="lg" align="center" className="mb-4" />
        <h1 className="text-3xl font-black uppercase tracking-tighter text-[#004aad] sm:text-4xl">Member onboarding</h1>
        <p className="mt-3 text-base font-semibold text-slate-600">
          {legacyFounder ? (
            <>
              Hi {firstName}, you&apos;re a <span className="font-black text-slate-800">founding member</span> on file. You
              don&apos;t need to retake PMES here — complete your official digital membership profile when prompted below.
            </>
          ) : (
            <>Hi {firstName}, your cooperative membership follows Board-approved steps after PMES.</>
          )}
        </p>
      </div>

      {stage === "PMES_NOT_PASSED" || stage === "NO_PARTICIPANT" ? (
        clientPmesPassed ? (
          <section className="card-senior space-y-6 border-emerald-200/80 bg-emerald-50/40 p-8 text-left">
            <div className="flex items-start gap-3">
              <ClipboardList className="h-10 w-10 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <h2 className="text-xl font-black text-slate-900">PMES completed on this account</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  Your exam and certificate are available here. Continue with your Letter of Intent and payment — the office may still be syncing your passing record.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {typeof onViewCertificate === "function" ? (
                    <button type="button" onClick={onViewCertificate} className="btn-primary w-full sm:w-auto">
                      View certificate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onOpenLoi}
                    className="w-full rounded-2xl border-2 border-emerald-600 bg-emerald-600 px-6 py-3.5 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
                  >
                    Letter of Intent
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
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
        )
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
        <section className="card-senior space-y-6 p-6 text-left sm:p-8">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-6">
            <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <h2 className="text-xl font-black text-slate-900">B2C membership form</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                {legacyFounder ? (
                  <>
                    As an existing pledged member, you&apos;re only registering your account in this system. Complete the
                    official consumer cooperative membership sheet below so your records match the cooperative file. You
                    can download your entries as CSV or attach a scan/PDF of a filled paper form.
                  </>
                ) : (
                  <>
                    Board approval is on file. Complete the official consumer cooperative membership sheet below (aligned
                    to your paper form). You can download your entries as CSV anytime, or attach a scan/PDF of a filled
                    paper form.
                  </>
                )}
              </p>
            </div>
          </div>
          <MemberFullProfileForm
            memberEmail={email}
            submitting={submitting}
            localError={localError}
            onSubmitSuccess={handleFullSuccess}
          />
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
