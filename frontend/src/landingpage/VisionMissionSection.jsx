import { Quote } from "lucide-react";
import { B2C_VISION, B2C_MISSION_LINES } from "../constants/cooperativeBrand.js";

/**
 * Public landing block for official B2C Coop vision and mission.
 * Typography matches hero subcopy and “At a glance” section labels.
 */
export function VisionMissionSection() {
  return (
    <section
      id="vision-mission"
      className="mesh-stats relative border-y border-white/40 py-14 sm:py-16 lg:py-20"
      aria-labelledby="vision-mission-heading"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <h2 id="vision-mission-heading" className="text-sm font-bold tracking-wide text-stone-600 sm:text-base">
            Who we are
          </h2>
          <p className="mt-4 text-2xl font-extrabold leading-[1.12] tracking-tight text-stone-900 sm:text-3xl md:text-4xl">
            B2C Coop{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-teal-600 bg-clip-text text-transparent">
              vision
            </span>{" "}
            &amp;{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-teal-600 bg-clip-text text-transparent">
              mission
            </span>
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-stone-600 sm:text-base">
            What we aspire to become — and how we serve members every day.
          </p>
        </div>

        <div className="glass-card relative mx-auto max-w-5xl overflow-hidden rounded-3xl shadow-xl shadow-stone-900/[0.06]">
          <Quote
            className="pointer-events-none absolute right-6 top-6 h-10 w-10 text-indigo-200/70 sm:right-8 sm:top-8 sm:h-12 sm:w-12"
            aria-hidden
          />
          <div className="grid lg:grid-cols-2">
            <article className="relative flex flex-col justify-center border-b border-stone-200/50 px-6 py-8 sm:px-10 sm:py-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#004aad]">Vision</p>
              <p className="mt-4 text-base font-medium leading-relaxed text-stone-600 sm:text-lg sm:leading-[1.65]">
                {B2C_VISION}
              </p>
            </article>

            <article className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#004aad]">Mission</p>
              <blockquote className="mt-4 border-none p-0">
                <div className="space-y-0.5 text-base font-medium leading-snug sm:text-lg sm:leading-snug">
                  {B2C_MISSION_LINES.map((line, index) => (
                    <p
                      key={line}
                      className={
                        index === 0
                          ? "font-semibold text-stone-900"
                          : index === 3
                            ? "pt-1 font-semibold text-stone-800"
                            : "text-stone-600"
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </blockquote>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
