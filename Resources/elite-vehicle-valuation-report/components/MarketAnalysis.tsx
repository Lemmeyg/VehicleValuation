
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ValuationResult } from '../types';

interface MarketAnalysisProps {
  valuation: ValuationResult;
}

const MarketAnalysis: React.FC<MarketAnalysisProps> = ({ valuation }) => {
  const bellCurve = Array.from({ length: 40 }, (_, i) => {
    const x = valuation.lowValue + (valuation.highValue - valuation.lowValue) * (i / 39);
    const mean = valuation.averageValue;
    const stdDev = (valuation.highValue - valuation.lowValue) / 4;
    const y = Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
    return { price: x, density: y };
  });

  return (
    <div className="glass-card rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold mb-1 text-slate-900">Market Distribution</h2>
          <p className="text-sm text-slate-500">Based on {valuation.dataPoints} comparable data points</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
            Confidence: {valuation.confidence}
          </span>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={bellCurve}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00a878" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#00a878" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
              dataKey="price" 
              type="number" 
              domain={[valuation.lowValue * 0.9, valuation.highValue * 1.1]}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              stroke="#94a3b8"
              tick={{fill: '#64748b', fontSize: 12}}
            />
            <YAxis hide />
            <Tooltip 
              contentStyle={{backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              formatter={(value: number) => [``, 'Relative Frequency']}
              labelFormatter={(label) => `Market Price: $${Math.round(label).toLocaleString()}`}
            />
            <Area 
              type="monotone" 
              dataKey="density" 
              stroke="#00a878" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
            />
            <ReferenceLine x={valuation.averageValue} stroke="#00a878" strokeDasharray="5 5" label={{ value: 'AVG', position: 'top', fill: '#00a878', fontSize: 12, fontWeight: 'bold' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8">
        <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-semibold">Low Range</p>
          <p className="text-xl font-bold text-slate-800">${valuation.lowValue.toLocaleString()}</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-xs text-primary uppercase tracking-widest mb-1 font-bold">Fair Market Value</p>
          <p className="text-2xl font-black text-slate-900">${valuation.averageValue.toLocaleString()}</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-semibold">High Range</p>
          <p className="text-xl font-bold text-slate-800">${valuation.highValue.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default MarketAnalysis;
