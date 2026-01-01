
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import VehicleInfo from './components/VehicleInfo';
import MarketAnalysis from './components/MarketAnalysis';
import DecisionTool from './components/DecisionTool';
import HistorySection from './components/HistorySection';
import ComparablesList from './components/ComparablesList';
import { mockReport } from './services/mockData';
import { ReportData } from './types';

const ReportView: React.FC = () => {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(mockReport);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary font-bold animate-pulse">Generating Premium Valuation Report...</p>
        </div>
      </div>
    );
  }

  // Combine and slice to 10 comparables
  const allComparables = [
    ...data.valuation_result.comparables,
    ...data.marketcheck_valuation.comparables
  ].slice(0, 10);

  return (
    <div className="min-h-screen bg-background pt-8 pb-20">
      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Title & Metadata Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold">
              <span>Vehicle Valuation Report</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
              <span>ID: {data.id.substring(0, 8)}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {data.vehicle_data.year} {data.vehicle_data.make} {data.vehicle_data.model}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                {data.vin}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="text-sm font-medium text-slate-500">Report Date: {new Date(data.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-white hover:bg-slate-50 px-4 py-2 rounded-xl transition-all border border-slate-200 text-sm font-bold text-slate-700 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m3 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2z" />
              </svg>
              Print
            </button>
            <button className="flex items-center gap-2 bg-primary hover:bg-primary-dark px-4 py-2 rounded-xl transition-all text-sm font-bold text-white shadow-md shadow-primary/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* 1. Top Level Summary Cards (Header Modals) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 border-l-4 border-l-primary shadow-sm">
            <p className="text-xs text-primary uppercase font-bold tracking-widest mb-1">Estimated Value</p>
            <h3 className="text-4xl font-black text-slate-900">${data.valuation_result.averageValue.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[88%]"></div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">High Reliability</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 border-l-4 border-l-amber-500 shadow-sm">
            <p className="text-xs text-amber-600 uppercase font-bold tracking-widest mb-1">History Events</p>
            <h3 className="text-4xl font-black text-slate-900">{data.accident_details.totalAccidents}</h3>
            <p className="text-sm font-medium text-slate-400 mt-2 italic">Requires verification review</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 border-l-4 border-l-blue-600 shadow-sm">
            <p className="text-xs text-blue-600 uppercase font-bold tracking-widest mb-1">AI Prediction</p>
            <h3 className="text-4xl font-black text-slate-900">${data.marketcheck_valuation.predictedPrice.toLocaleString()}</h3>
            <p className="text-sm font-medium text-slate-400 mt-2">Machine learning market model</p>
          </div>
        </div>

        {/* 2. Vehicle Specifications */}
        <VehicleInfo vehicle={data.vehicle_data} />

        {/* 3. Market Trends Visualization */}
        <MarketAnalysis valuation={data.valuation_result} />

        {/* 4. Detailed History */}
        <HistorySection accidents={data.accident_details.accidents} />

        {/* 5. Comparables Section (Up to 10) */}
        <ComparablesList comparables={allComparables} />

        {/* 6. Collision Decision Support (Very Bottom) */}
        <DecisionTool data={data} />

        {/* 7. Legal Disclaimer Space */}
        <div className="mt-16 pt-8 border-t border-slate-200">
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Legal Disclaimer & Methodology</h4>
            <div className="space-y-4 text-sm text-slate-500 leading-relaxed">
              <p>
                The information provided in this valuation report ("Report") is intended for general informational purposes only and does not constitute a professional appraisal, legal advice, or a binding offer of purchase or sale. Valuations are generated using proprietary algorithms that aggregate data from third-party sources including VinAudit, Auto.dev, CarsXE, and MarketCheck. 
              </p>
              <p>
                While we strive for accuracy, vehicle market values are subject to rapid change based on local demand, condition variances not captured in data, and economic fluctuations. The "Collision Decision Support" tool is an estimation based on standard industry thresholds (e.g., 70% total loss rule) and should not be used as the sole basis for financial or insurance decisions. 
              </p>
              <p>
                By using this Report, you acknowledge that the vehicle's actual cash value (ACV) may differ from these estimates. We recommend consulting with a certified appraiser or your insurance adjuster for final settlement figures.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-8 font-bold text-slate-400 text-xs">
              <span>&copy; 2024 ELITE VALUATION SERVICES</span>
              <a href="#" className="hover:text-primary transition-colors uppercase">Terms of Service</a>
              <a href="#" className="hover:text-primary transition-colors uppercase">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors uppercase">Contact Support</a>
            </div>
          </div>
        </div>
      </main>

      {/* Persistent Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 sm:hidden flex justify-between items-center z-50 shadow-2xl">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Fair Value</p>
          <p className="text-lg font-black text-slate-900">${data.valuation_result.averageValue.toLocaleString()}</p>
        </div>
        <button className="bg-primary px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20">
          Decision Tool
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ReportView />} />
      </Routes>
    </Router>
  );
};

export default App;
