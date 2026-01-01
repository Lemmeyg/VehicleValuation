
import React from 'react';
import { ComparableVehicle } from '../types';

interface ComparablesListProps {
  comparables: ComparableVehicle[];
}

const ComparablesList: React.FC<ComparablesListProps> = ({ comparables }) => {
  return (
    <div className="glass-card rounded-2xl p-6 overflow-hidden mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2m14 0h2a2 2 0 012 2v16m-10 0V3m4 0h.01M9 16h.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Market Comparables</h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Vehicle Details</th>
              <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Mileage</th>
              <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Market Price</th>
              <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Location</th>
              <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest text-right">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {comparables.map((comp, idx) => (
              <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                <td className="py-4">
                  <div className="font-bold text-slate-900">{comp.year} {comp.make} {comp.model}</div>
                  <div className="text-xs font-semibold text-slate-500">{comp.trim || 'Base Trim'}</div>
                </td>
                <td className="py-4 text-sm font-medium text-slate-600">
                  {(comp.mileage || comp.miles || 0).toLocaleString()} mi
                </td>
                <td className="py-4 font-bold text-primary">
                  ${comp.price.toLocaleString()}
                </td>
                <td className="py-4 text-sm font-medium text-slate-600">
                  {typeof comp.location === 'string' ? comp.location : `${comp.location?.city}, ${comp.location?.state}`}
                </td>
                <td className="py-4 text-sm text-right">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 text-[10px] uppercase font-bold tracking-tight">
                    {comp.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparablesList;
