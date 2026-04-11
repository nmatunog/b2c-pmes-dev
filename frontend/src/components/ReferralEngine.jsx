import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  Copy,
  Gift,
  Lock,
  Share2,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { PUBLIC_MEMBER_COUNT } from "../constants/cooperativeBrand.js";
import {
  COUNT_REWARD_TIERS,
  PIONEER_POINTS_PER_JOIN,
  getApproxPercentileLabel,
  getHighestTierUnlocked,
  getLeaderboardStatusFromPoints,
} from "../lib/referralTiers.js";

const TIER_ICONS = [Award, Users, Gift];

/**
 * Member-only referral / growth panel: personal link, count tiers, Pioneer Points, leaderboard hints.
 * Styling matches PMES `card-senior` / blue `#004aad` shell.
 *
 * @param {{
 *   memberName: string,
 *   referralCode: string,
 *   successfulJoinCount?: number,
 *   pioneerPoints?: number,
 *   invitesThisMonth?: number,
 * }} props
 */
export function ReferralEngine({
  memberName,
  referralCode,
  successfulJoinCount = 0,
  pioneerPoints = 0,
  invitesThisMonth = 0,
}) {
  const [copied, setCopied] = useState(false);

  const referralLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin.replace(/\/$/, "");
    return `${base}/?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode]);

  const firstName = String(memberName || "Member").trim().split(/\s+/)[0] || "Member";
  const tierUnlocked = getHighestTierUnlocked(successfulJoinCount);
  const leaderboard = getLeaderboardStatusFromPoints(pioneerPoints);
  const percentile = getApproxPercentileLabel(pioneerPoints);

  const handleCopy = () => {
    if (!referralLink) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(referralLink).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      });
    } else {
      try {
        const el = document.createElement("textarea");
        el.value = referralLink;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* noop */
      }
    }
  };

  return (
    <section
      className="card-senior w-full max-w-5xl space-y-10 border-[10px] border-[#004aad]/[0.06] bg-white text-slate-800 shadow-[0_40px_80px_rgba(0,0,0,0.08)]"
      aria-labelledby="referral-engine-heading"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="text-left">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#004aad]/15 bg-[#004aad]/5 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#004aad]">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Pioneer growth
          </p>
          <h2 id="referral-engine-heading" className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Share the{" "}
            <span className="bg-gradient-to-r from-[#004aad] to-sky-500 bg-clip-text text-transparent">movement</span>
          </h2>
          <p className="mt-3 max-w-lg text-base font-medium leading-relaxed text-slate-600">
            Hey {firstName}, every successful join through your link earns <strong>{PIONEER_POINTS_PER_JOIN} Pioneer Points</strong>{" "}
            and counts toward assembly recognition tiers. Rankings compare you to the wider member base (currently{" "}
            {PUBLIC_MEMBER_COUNT} registered owners — illustrative until the live leaderboard ships).
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-4 shadow-inner">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-900/15">
            <Trophy className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Pioneer Points</p>
            <p className="text-3xl font-black tabular-nums tracking-tight text-slate-900">{pioneerPoints.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
        <div className="space-y-8 lg:col-span-3">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#004aad]/80">
                Personal invitation link
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Target className="h-3 w-3" aria-hidden /> Tracked
              </span>
            </div>
            <div className="relative">
              <div className="break-all rounded-2xl border-4 border-slate-200 bg-slate-50 px-4 py-4 pr-36 font-mono text-sm text-slate-800">
                {referralLink || "…"}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-1/2 flex min-h-[44px] -translate-y-1/2 items-center gap-2 rounded-xl bg-[#004aad] px-5 text-xs font-extrabold uppercase tracking-widest text-white shadow-md transition hover:bg-[#003d99] active:scale-[0.98]"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs font-medium italic leading-relaxed text-slate-500">
              Code <span className="font-mono font-bold not-italic text-slate-700">{referralCode}</span> — share in Viber,
              Messenger, or SMS. New owners must complete signup through this link for the join to count.
            </p>
          </div>

          <div>
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Rewards tier (by invites)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {COUNT_REWARD_TIERS.map((tier) => {
                const unlocked = successfulJoinCount >= tier.threshold;
                const TierIcon = TIER_ICONS[tier.level - 1] ?? Award;
                return (
                  <div
                    key={tier.level}
                    className={`rounded-2xl border p-4 text-center transition ${
                      unlocked
                        ? "border-emerald-200 bg-emerald-50/80 shadow-sm"
                        : "border-slate-200 bg-slate-50/90 opacity-90"
                    }`}
                  >
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-[#004aad]">
                      {unlocked ? (
                        <TierIcon className="h-9 w-9 text-emerald-600" aria-hidden />
                      ) : (
                        <Lock className="h-8 w-8 text-slate-300" aria-hidden />
                      )}
                    </div>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{tier.shortLabel}</p>
                    <p className="mt-1 text-xs font-extrabold text-slate-900">{tier.reward}</p>
                    <p className="mt-1 text-[10px] font-medium leading-snug text-slate-600">{tier.recognition}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="h-full rounded-3xl border border-slate-200 bg-slate-50/90 p-6 shadow-inner sm:p-8">
            <h3 className="mb-8 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#004aad]">
              <Activity className="h-4 w-4" aria-hidden />
              Growth &amp; status
            </h3>

            <div className="space-y-8 border-b border-slate-200/90 pb-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black tabular-nums text-slate-900">{successfulJoinCount}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Successful joins</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                    {invitesThisMonth > 0 ? `+${invitesThisMonth} this month` : "No adds this month yet"}
                  </p>
                  <p className="mt-1 text-[9px] font-medium text-slate-400">Keeps your rank feeling live</p>
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className={`text-3xl font-black tracking-tight sm:text-4xl ${leaderboard.tone}`}>{leaderboard.label}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Leaderboard band</p>
                  {percentile ? (
                    <p className="mt-2 text-sm font-bold text-slate-700">
                      {percentile} <span className="font-medium text-slate-500">of ~{PUBLIC_MEMBER_COUNT} members (preview)</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Percentile appears once you have points.</p>
                  )}
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#004aad]/20 bg-white shadow-sm">
                  <Award className="h-8 w-8 text-[#004aad]" aria-hidden />
                </div>
              </div>
            </div>

            {tierUnlocked ? (
              <p className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-xs font-semibold leading-relaxed text-amber-950">
                Unlocked: <strong>{tierUnlocked.reward}</strong> — {tierUnlocked.recognition}
              </p>
            ) : (
              <p className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-xs font-medium leading-relaxed text-slate-600">
                Next tier: <strong>{COUNT_REWARD_TIERS[0].threshold} invites</strong> for the Co-op Badge and &quot;Recognized
                Pioneer&quot; status.
              </p>
            )}

            <p className="mt-6 text-center text-[11px] font-medium italic leading-relaxed text-slate-500">
              Building the digital future of our co-op — one invitation at a time.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50/40 p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4 sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#004aad]/10 ring-1 ring-[#004aad]/15">
            <Share2 className="h-6 w-6 text-[#004aad]" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-black uppercase tracking-tight text-slate-900">Annual General Assembly recognition</p>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Top builders are honored at the next AGM. VIP and Founder tiers unlock visibility from your invite milestones above.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#004aad]">
          Leaderboard <ArrowRight className="h-4 w-4" aria-hidden />
          <span className="sr-only">(coming with live data)</span>
        </span>
      </div>
    </section>
  );
}

export default ReferralEngine;
