'use client';

import React, { useState } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Rocket, 
  ArrowUpRight, 
  Activity, 
  History 
} from 'lucide-react';

/**
 * B2C EARNINGS DASHBOARD COMPONENT
 * * Logic:
 * - Weekly Spend * 4 * 12 * 5% (Patronage Refund)
 * - (Initial Capital + (Monthly * 6)) * 5% (Average Annual Dividend)
 * - Total Equity = Initial + (Monthly * 12)
 */

const EarningsDashboard = ({ onJoinClick }) => {
  // Simulator Input States
  const [weeklySpend, setWeeklySpend] = useState(2500);
  const [shareCapital, setShareCapital] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(200);

  // Constants for calculation (Adjustable for production)
  const estRefundRate = 0.05; 
  const estDividendRate = 0.05; 
  
  // Calculations
  const annualRefund = (weeklySpend * 4 * 12) * estRefundRate;
  const averageAnnualCapital = shareCapital + (monthlyContribution * 6);
  const annualDividend = averageAnnualCapital * estDividendRate;
  const totalAnnualEarnings = annualRefund + annualDividend;
  const totalEquityYearOne = shareCapital + (monthlyContribution * 12);

  return (
    <section className="py-24 md:py-40 bg-[#070918] text-white relative overflow-hidden rounded-[60px] md:rounded-[100px] mx-2 md:mx-10 shadow-2xl">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent -z-0" />
      <div className="absolute bottom-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent -z-0 blur-3xl" />
      
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-32 items-center">
          
          {/* Left Side: Simulation Controls */}
          <div className="space-y-12 text-left">
            <div>
              <div className="inline-flex items-center gap-3 bg-indigo-500/10 text-indigo-400 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] mb-10 border border-indigo-500/20 shadow-inner">
                <Calculator className="w-4 h-4" /> Member Benefit Simulation
              </div>
              <h2 className="text-5xl md:text-[92px] font-black tracking-[calc(-0.04em)] leading-[0.85]">
                Earnings <br/>Simulator.
              </h2>
              <p className="text-indigo-200/50 text-xl mt-10 font-medium max-w-md leading-relaxed">
                Calculate exactly how much wealth you build through daily spending and capital growth.
              </p>
            </div>

            <div className="space-y-16 bg-white/[0.02] p-8 md:p-12 rounded-[56px] border border-white/10 backdrop-blur-3xl shadow-inner relative overflow-hidden">
              {/* Weekly Budget Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300/50">Weekly Grocery Spend</label>
                  <span className="text-4xl md:text-5xl font-black text-white font-mono tracking-tighter">₱{weeklySpend.toLocaleString()}</span>
                </div>
                <input 
                  type="range" min="500" max="15000" step="100" 
                  value={weeklySpend} 
                  onChange={(e) => setWeeklySpend(parseInt(e.target.value))} 
                  className="w-full h-3 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500 transition-all" 
                />
              </div>

              {/* Initial Investment Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300/50">Initial Share Capital</label>
                  <span className="text-4xl md:text-5xl font-black text-white font-mono tracking-tighter">₱{shareCapital.toLocaleString()}</span>
                </div>
                <input 
                  type="range" min="1000" max="200000" step="1000" 
                  value={shareCapital} 
                  onChange={(e) => setShareCapital(parseInt(e.target.value))} 
                  className="w-full h-3 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500 transition-all" 
                />
              </div>

              {/* Monthly Contribution Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Monthly Added Shares</label>
                  <span className="text-4xl md:text-5xl font-black text-indigo-400 font-mono tracking-tighter">₱{monthlyContribution.toLocaleString()}</span>
                </div>
                <input 
                  type="range" min="100" max="10000" step="100" 
                  value={monthlyContribution} 
                  onChange={(e) => setMonthlyContribution(parseInt(e.target.value))} 
                  className="w-full h-3 bg-indigo-900/50 rounded-full appearance-none cursor-pointer accent-indigo-400 transition-all" 
                />
              </div>
            </div>
          </div>

          {/* Right Side: Pro Results Dashboard */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-[70px] blur-3xl opacity-10 group-hover:opacity-20 transition duration-1000" />
            <div className="bg-white rounded-[48px] md:rounded-[64px] p-8 md:p-16 text-slate-900 relative shadow-2xl overflow-hidden text-left border-4 border-white">
              <div className="absolute top-0 right-0 p-12 opacity-5"><History className="w-32 h-32" /></div>
              
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mb-12 flex items-center gap-3 leading-none">
                <Activity className="w-5 h-5" /> Annual Projected Returns
              </h3>
              
              <div className="space-y-10 mb-16 relative z-10">
                {/* Itemized Returns */}
                <div className="flex justify-between items-center border-b border-indigo-50 pb-8">
                  <div>
                    <p className="text-xl font-black text-slate-900 tracking-tight mb-2">Projected Cash Back</p>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Patronage Refund (5%)</p>
                  </div>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">₱{annualRefund.toLocaleString()}</p>
                </div>

                <div className="flex justify-between items-center border-b border-indigo-50 pb-8">
                  <div>
                    <p className="text-xl font-black text-slate-900 tracking-tight mb-2">Projected Dividends</p>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Share Dividend (5%)</p>
                  </div>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">₱{Math.round(annualDividend).toLocaleString()}</p>
                </div>

                {/* Main Total Value */}
                <div className="pt-6">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Total Member Value</p>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-4 mb-2">
                      <span className="text-7xl md:text-[100px] font-black text-indigo-600 leading-[0.8] tracking-[calc(-0.06em)]">
                        ₱{Math.round(totalAnnualEarnings).toLocaleString()}
                      </span>
                      <span className="text-2xl text-slate-300 font-bold">/ yr</span>
                    </div>
                    
                    {/* Capital Equity Accumulation */}
                    <div className="inline-flex items-center gap-3 bg-indigo-50/50 w-fit px-6 py-2.5 rounded-2xl border border-indigo-100/50 mt-6">
                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                         Estimated Capital Equity: <span className="text-indigo-600">₱{totalEquityYearOne.toLocaleString()}</span> after 12 months
                       </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call to Action Button */}
              <button 
                onClick={onJoinClick}
                className="w-full bg-slate-900 text-white py-8 rounded-[32px] font-black text-2xl hover:bg-black transition-all flex items-center justify-center gap-4 group shadow-2xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                Join Movement <ArrowUpRight className="w-7 h-7 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default EarningsDashboard;