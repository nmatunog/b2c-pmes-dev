import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Calculator,
  History,
} from "lucide-react";
import { computeEarningsProjection, EST_REFUND_RATE, EST_DIVIDEND_RATE } from "../lib/earningsProjection.js";

/**
 * Alternate “indigo” marketing shell for the earnings preview (same math as `landingpage/EarningsSimulator.jsx`).
 * Canonical landing UI uses the mesh `EarningsSimulator` on `LandingPage`; this module is for A/B or embeds.
 */

export default function EarningsDashboard({ onJoinClick }) {
  const [weeklySpend, setWeeklySpend] = useState(2500);
  const [shareCapital, setShareCapital] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);

  const { annualRefund, annualDividend, totalAnnualEarnings, totalEquityYearOne } = computeEarningsProjection({
    weeklySpend,
    shareCapital,
    monthlyContribution,
  });

  return (
    <section className="relative mx-2 overflow-hidden rounded-[60px] bg-[#070918] py-24 text-white shadow-2xl md:mx-10 md:rounded-[100px] md:py-40">
      <div className="absolute left-0 top-0 -z-0 h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent" />
      <div className="absolute bottom-0 right-0 -z-0 h-full w-1/2 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-12 lg:px-20">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-32">
          <div className="space-y-12 text-left">
            <div>
              <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400 shadow-inner">
                <Calculator className="h-4 w-4" /> Member benefit simulation
              </div>
              <h2 className="text-5xl font-black leading-[0.85] tracking-[calc(-0.04em)] md:text-[92px]">
                Earnings <br />
                Simulator.
              </h2>
              <p className="mt-10 max-w-md text-xl font-medium leading-relaxed text-indigo-200/50">
                Illustrative patronage ({Math.round(EST_REFUND_RATE * 100)}%) and dividend-style returns (
                {Math.round(EST_DIVIDEND_RATE * 100)}% on average capital). Not financial advice.
              </p>
            </div>

            <div className="relative space-y-16 overflow-hidden rounded-[56px] border border-white/10 bg-white/[0.02] p-8 shadow-inner backdrop-blur-3xl md:p-12">
              <SliderRow
                label="Weekly grocery spend"
                value={weeklySpend}
                min={500}
                max={15000}
                step={100}
                onChange={setWeeklySpend}
                accent="white"
              />
              <SliderRow
                label="Initial share capital"
                value={shareCapital}
                min={1000}
                max={200000}
                step={1000}
                onChange={setShareCapital}
                accent="white"
              />
              <SliderRow
                label="Monthly added shares"
                value={monthlyContribution}
                min={100}
                max={10000}
                step={100}
                onChange={setMonthlyContribution}
                accent="indigo"
              />
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -inset-4 rounded-[70px] bg-gradient-to-tr from-indigo-600 to-blue-600 opacity-10 blur-3xl transition duration-1000 group-hover:opacity-20" />
            <div className="relative overflow-hidden rounded-[48px] border-4 border-white bg-white p-8 text-left text-slate-900 shadow-2xl md:rounded-[64px] md:p-16">
              <div className="absolute right-0 top-0 p-12 opacity-5">
                <History className="h-32 w-32" />
              </div>

              <h3 className="mb-12 flex items-center gap-3 text-[10px] font-black uppercase leading-none tracking-[0.4em] text-indigo-600">
                <Activity className="h-5 w-5" /> Annual projected returns
              </h3>

              <div className="relative z-10 mb-16 space-y-10">
                <div className="flex items-center justify-between border-b border-indigo-50 pb-8">
                  <div>
                    <p className="mb-2 text-xl font-black tracking-tight text-slate-900">Projected cash back</p>
                    <p className="text-[10px] font-black uppercase leading-none tracking-widest text-indigo-400">
                      Patronage refund ({Math.round(EST_REFUND_RATE * 100)}%)
                    </p>
                  </div>
                  <p className="text-3xl font-black tracking-tighter text-indigo-600">₱{Math.round(annualRefund).toLocaleString()}</p>
                </div>

                <div className="flex items-center justify-between border-b border-indigo-50 pb-8">
                  <div>
                    <p className="mb-2 text-xl font-black tracking-tight text-slate-900">Projected dividends</p>
                    <p className="text-[10px] font-black uppercase leading-none tracking-widest text-indigo-400">
                      Share dividend ({Math.round(EST_DIVIDEND_RATE * 100)}%)
                    </p>
                  </div>
                  <p className="text-3xl font-black tracking-tighter text-indigo-600">₱{Math.round(annualDividend).toLocaleString()}</p>
                </div>

                <div className="pt-6">
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Total member value</p>
                  <div className="flex flex-col">
                    <div className="mb-2 flex items-baseline gap-4">
                      <span className="text-7xl font-black leading-[0.8] tracking-[calc(-0.06em)] text-indigo-600 md:text-[100px]">
                        ₱{Math.round(totalAnnualEarnings).toLocaleString()}
                      </span>
                      <span className="text-2xl font-bold text-slate-300">/ yr</span>
                    </div>
                    <div className="mt-6 inline-flex w-fit items-center gap-3 rounded-2xl border border-indigo-100/50 bg-indigo-50/50 px-6 py-2.5">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                      <p className="text-[11px] font-black uppercase leading-none tracking-[0.2em] text-slate-400">
                        Est. capital equity:{" "}
                        <span className="text-indigo-600">₱{totalEquityYearOne.toLocaleString()}</span> after 12 months
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onJoinClick}
                className="group relative w-full overflow-hidden rounded-[32px] bg-slate-900 py-8 text-2xl font-black text-white shadow-2xl transition-all hover:bg-black flex items-center justify-center gap-4"
              >
                <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-indigo-600/20 to-transparent transition-transform duration-1000 group-hover:translate-x-[100%]" />
                Join movement <ArrowUpRight className="h-7 w-7 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderRow({ label, value, min, max, step, onChange, accent }) {
  const valueClass = accent === "indigo" ? "text-indigo-400" : "text-white";
  const trackClass = accent === "indigo" ? "bg-indigo-900/50 accent-indigo-400" : "bg-slate-800 accent-indigo-500";
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300/50">{label}</label>
        <span className={`font-mono text-4xl font-black tracking-tighter md:text-5xl ${valueClass}`}>₱{value.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={`h-3 w-full cursor-pointer appearance-none rounded-full ${trackClass}`}
      />
    </div>
  );
}
