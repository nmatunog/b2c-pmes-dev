import { MapPin, Plus, ShieldCheck, Star, Users } from "lucide-react";
import { COOPERATIVE_REGION, PUBLIC_MEMBER_COUNT } from "../constants/cooperativeBrand.js";
import { VERIFIED_PIONEERS } from "../data/verifiedPioneers.js";

/**
 * “Verified pioneers” wall — bridges earnings simulator and membership path.
 * Light mesh section, glass cards, live pulse for Cebu-local movement feel.
 *
 * @param {{ onJoinClick?: () => void, memberCount?: number }} props
 */
export function MemberSpotlight({ onJoinClick, memberCount = PUBLIC_MEMBER_COUNT }) {
  const nextSlot = memberCount + 1;

  return (
    <section
      id="member-spotlight"
      className="mesh-stats relative border-y border-white/40 py-14 sm:py-16 lg:py-20"
      aria-labelledby="member-spotlight-heading"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-20 top-1/4 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-teal-400/8 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-8 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl text-left">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="glass-badge inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-700">
                <Users className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                Verified pioneers
              </p>
              <LivePulseCebu />
            </div>
            <h2
              id="member-spotlight-heading"
              className="text-3xl font-extrabold leading-[1.1] tracking-tight text-stone-900 sm:text-4xl md:text-5xl"
            >
              Real members,{" "}
              <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-teal-600 bg-clip-text text-transparent">
                local to Cebu
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-stone-600 sm:text-lg">
              From estimates to people — meet neighbors already in the movement. Names and areas are from our verified registry;
              this grid is a sample of the full membership.
            </p>
          </div>

          <div className="glass-card flex shrink-0 items-center gap-5 rounded-2xl px-6 py-5 shadow-lg sm:rounded-3xl sm:px-8 sm:py-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">CDA registry</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-stone-900">{memberCount}</p>
              <p className="mt-0.5 text-xs font-semibold text-stone-500">verified members</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25">
              <Star className="h-7 w-7 fill-current" aria-hidden />
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {VERIFIED_PIONEERS.map((member) => (
            <article
              key={member.id}
              className="group flex min-h-[168px] flex-col justify-between rounded-2xl border border-white/60 bg-white/55 p-4 shadow-md shadow-stone-900/[0.04] ring-1 ring-white/70 backdrop-blur-xl transition-all duration-300 hover:border-blue-200/80 hover:bg-white/80 hover:shadow-lg hover:shadow-blue-900/[0.06] sm:min-h-[176px] sm:rounded-3xl sm:p-5"
            >
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100/90 bg-gradient-to-br from-blue-50 to-sky-50 text-xs font-extrabold text-blue-700 shadow-sm transition-colors group-hover:bg-blue-600 group-hover:text-white sm:h-12 sm:w-12">
                  {member.initials}
                </div>
                <p className="text-sm font-bold leading-snug text-stone-900 transition-colors group-hover:text-blue-800">
                  {member.name}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  <MapPin className="h-3 w-3 shrink-0 text-blue-500" aria-hidden />
                  {member.location}
                </p>
              </div>
              <div
                className={`mt-3 inline-flex w-fit items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
                  member.status === "Founding Member"
                    ? "border-stone-800/20 bg-stone-900 text-white"
                    : "border-blue-100 bg-white text-blue-700"
                }`}
              >
                <ShieldCheck className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                {member.status}
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={onJoinClick}
            className="group relative flex min-h-[168px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-blue-600 to-blue-800 p-4 text-center shadow-xl shadow-blue-900/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:min-h-[176px] sm:rounded-3xl sm:p-5"
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            <span className="relative z-10 mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm transition-transform duration-500 group-hover:rotate-90 sm:h-12 sm:w-12">
              <Plus className="h-6 w-6 stroke-[2.5]" aria-hidden />
            </span>
            <span className="relative z-10 text-xs font-extrabold uppercase tracking-[0.2em] text-white">Pioneer #{nextSlot}</span>
            <span className="relative z-10 mt-2 text-[10px] font-semibold text-sky-100/90">Reserved for you</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function LivePulseCebu() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800 shadow-sm">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      </span>
      <span className="whitespace-nowrap">
        Live ·{" "}
        {COOPERATIVE_REGION.replace(", PHILIPPINES", "")
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase())}
      </span>
    </div>
  );
}

export default MemberSpotlight;
