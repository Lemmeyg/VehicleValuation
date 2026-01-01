
import React from 'react';
import { AccidentDetail } from '../types';

interface HistorySectionProps {
  accidents: AccidentDetail[];
}

const HistorySection: React.FC<HistorySectionProps> = ({ accidents }) => {
  return (
    <div className="glass-card rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-50 rounded-lg text-red-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Reported Accident History</h2>
      </div>

      {accidents.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="text-slate-500 font-medium">No accidents reported in database.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {accidents.map((accident, idx) => (
            <div key={idx} className="relative pl-8 border-l-2 border-slate-200">
              <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-red-500 shadow-sm border-2 border-white"></div>
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-500 font-bold uppercase tracking-tight">{accident.accidentDate || 'Unknown Date'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-sm font-bold text-red-600">{accident.severity} Impact</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Accident Event</h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-3xl font-medium">{accident.damageDescription}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-[240px]">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Event Parameters</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Location:</span>
                      <span className="text-slate-900 font-bold">{accident.location}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Est. Damage:</span>
                      <span className="text-slate-900 font-bold">${accident.estimatedCost?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Repaired:</span>
                      <span className={`font-bold ${accident.repaired ? 'text-green-600' : 'text-amber-600'}`}>
                        {accident.repaired ? 'Verified' : 'Unrepaired'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistorySection;
