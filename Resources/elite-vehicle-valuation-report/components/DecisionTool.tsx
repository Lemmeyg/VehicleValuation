
import React, { useState } from 'react';
import { ReportData } from '../types';

interface DecisionToolProps {
  data: ReportData;
}

const DecisionTool: React.FC<DecisionToolProps> = ({ data }) => {
  const [loanBalance, setLoanBalance] = useState<number>(15000);
  const [repairEstimate, setRepairEstimate] = useState<number>(5000);

  const marketValue = data.valuation_result.averageValue;
  const equityBeforeCollision = marketValue - loanBalance;
  const isTotalLossPossible = repairEstimate > (marketValue * 0.7);

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/20 rounded-lg text-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Collision Decision Support</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Your Loan Balance ($)</label>
            <input 
              type="number" 
              value={loanBalance}
              onChange={(e) => setLoanBalance(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Repair Estimate ($)</label>
            <input 
              type="number" 
              value={repairEstimate}
              onChange={(e) => setRepairEstimate(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-slate-900"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 border-l-4 border-l-primary shadow-sm">
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Analysis Result</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 text-sm">Current Market Value:</span>
              <span className="font-bold text-slate-900">${marketValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 text-sm">Equity Position:</span>
              <span className={`font-bold ${equityBeforeCollision >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${equityBeforeCollision.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between">
              <span className="text-slate-500 text-sm">Est. Total Loss Threshold:</span>
              <span className="font-bold text-slate-900">${(marketValue * 0.7).toLocaleString()}</span>
            </div>
            <div className="mt-4 p-3 rounded bg-slate-50 border border-slate-100">
              <p className="text-sm text-slate-700 leading-relaxed">
                {isTotalLossPossible 
                  ? "⚠️ Warning: Repair costs exceed 70% of vehicle value. Insurance may declare this a total loss."
                  : "✅ Repair cost is below the typical threshold. The vehicle is likely economically repairable."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecisionTool;
