import { useId, useState } from "react";
import { Activity, ArrowUpRight, Calculator, History } from "lucide-react";

/**
 * Illustrative member-value calculator: same logic as the legacy earnings dashboard
 * (weekly spend → patronage estimate; share capital + contributions → dividend estimate).
 * Not a promise of returns — blends with landing dark sections (mesh-path family).
 */

const EST_REFUND_RATE = 0.05;
const EST_DIVIDEND_RATE = 0.05;

export function EarningsSimulator({ onJoinClick }) {
  const idPrefix = useId();
  const [weeklySpend, setWeeklySpend] = useState(2500);
  const [shareCapital, setShareCapital] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);

  const annualRefund = weeklySpend * 4 * 12 * EST_REFUND_RATE;
  const averageAnnualCapital = shareCapital + monthlyContribution * 6;
  const annualDividend = averageAnnualCapital * EST_DIVIDEND_RATE;
  const totalAnnualEarnings = annualRefund + annualDividend;
  const totalEquityYearOne = shareCapital + monthlyContribution * 12;

  return (
    <section
      id="earnings-simulator"
      className="mesh-simulator relative overflow-hidden border-y border-white/10 py-16 text-white sm:py-20 lg:py-24"
      aria-labelledby="earnings-simulator-heading"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
          {/* Controls */}
          <div className="space-y-8 text-left lg:space-y-10">
            <div>
              <p className="glass-badge mb-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border-white/20 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200/95">
                <Calculator className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
                Member benefit preview
              </p>
              <h2
                id="earnings-simulator-heading"
                className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl"
              >
                Earnings{" "}
                <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">simulator</span>
              </h2>
              <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-stone-300/95">
                Slide the numbers to see illustrative patronage and dividend-style returns. Actual amounts depend on cooperative
                performance and board-approved rates.
              </p>
            </div>

            <div className="space-y-10 rounded-3xl border border-white/15 bg-white/[0.06] p-6 shadow-inner shadow-black/20 backdrop-blur-xl sm:p-8 md:p-10">
              <SliderBlock
                id={`${idPrefix}-weekly`}
                label="Weekly cooperative spend"
                hint="Household & personal care you route through the co-op"
                min={500}
                max={15000}
                step={100}
                value={weeklySpend}
                onChange={setWeeklySpend}
                accent="sky"
              />
              <SliderBlock
                id={`${idPrefix}-share`}
                label="Initial share capital"
                hint="Starting point (see PMES for current minimums)"
                min={1000}
                max={200000}
                step={1000}
                value={shareCapital}
                onChange={setShareCapital}
                accent="sky"
              />
              <SliderBlock
                id={`${idPrefix}-monthly`}
                label="Monthly added shares"
                hint="Optional build-up over the year"
                min={100}
                max={10000}
                step={100}
                value={monthlyContribution}
                onChange={setMonthlyContribution}
                accent="blue"
              />
            </div>
          </div>

          {/* Results */}
          <div className="relative lg:pt-2">
            <div className="pointer-events-none absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-sky-400/20 via-transparent to-blue-600/15 blur-xl opacity-70" aria-hidden />
            <div className="glass-path-card relative overflow-hidden rounded-3xl p-6 text-stone-900 shadow-2xl sm:p-8 md:p-10">
              <History className="pointer-events-none absolute right-6 top-6 h-16 w-16 text-blue-200/50 sm:h-20 sm:w-20" aria-hidden />

              <p className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                <Activity className="h-4 w-4 shrink-0" aria-hidden />
                Illustrative annual totals
              </p>

              <div className="space-y-8">
                <div className="flex flex-col gap-3 border-b border-stone-200/90 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-stone-900">Patronage-style refund</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-600/90">
                      Example {Math.round(EST_REFUND_RATE * 100)}% of annual patronage
                    </p>
                  </div>
                  <p className="text-2xl font-extrabold tabular-nums text-blue-700 sm:text-3xl">₱{Math.round(annualRefund).toLocaleString()}</p>
                </div>

                <div className="flex flex-col gap-3 border-b border-stone-200/90 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-stone-900">Share dividend (illustrative)</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-600/90">
                      On average capital × {Math.round(EST_DIVIDEND_RATE * 100)}% (simplified)
                    </p>
                  </div>
                  <p className="text-2xl font-extrabold tabular-nums text-blue-700 sm:text-3xl">
                    ₱{Math.round(annualDividend).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">Combined illustrative return</p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-2">
                    <span className="text-4xl font-extrabold tabular-nums tracking-tight text-blue-700 sm:text-5xl md:text-6xl">
                      ₱{Math.round(totalAnnualEarnings).toLocaleString()}
                    </span>
                    <span className="text-lg font-semibold text-stone-400">/ year</span>
                  </div>
                  <div className="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-blue-100/80 bg-blue-50/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-500" aria-hidden />
                    Est. equity after 12 months:{" "}
                    <span className="font-bold text-blue-800 tabular-nums">₱{totalEquityYearOne.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <p className="mt-8 text-xs leading-relaxed text-stone-500">
                For education only — not financial advice. Rates, refunds, and dividends follow bylaws, board decisions, and actual
                patronage; your PMES coach can explain how this applies to you.
              </p>

              {typeof onJoinClick === "function" ? (
                <button
                  type="button"
                  onClick={onJoinClick}
                  className="group mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-blue-600"
                >
                  Join us
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderBlock({ id, label, hint, min, max, step, value, onChange, accent }) {
  const track = accent === "blue" ? "bg-blue-900/40" : "bg-stone-700/80";
  const valueClass = accent === "blue" ? "text-sky-300" : "text-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400">
            {label}
          </label>
          {hint ? <p className="mt-1 text-xs font-medium text-stone-500">{hint}</p> : null}
        </div>
        <span className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${valueClass}`}>₱{value.toLocaleString()}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-2.5 w-full cursor-pointer appearance-none rounded-full ${track} accent-sky-500`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
    </div>
  );
}
