
import React from 'react';

const PremiumHeader: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card px-6 py-4 flex items-center justify-between border-b border-gray-200">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900">Vehicle Valuation</span>
      </div>
      
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
        <a href="#" className="hover:text-primary transition-colors">Dashboard</a>
        <a href="#" className="text-slate-900 border-b-2 border-primary pb-1">Report View</a>
        <a href="#" className="hover:text-primary transition-colors">Directory</a>
        <a href="#" className="hover:text-primary transition-colors">Pricing</a>
      </nav>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">A</div>
          <span>admin@gmail.com</span>
        </div>
        <button className="text-sm font-semibold text-slate-500 hover:text-primary transition-colors">Sign Out</button>
      </div>
    </header>
  );
};

export default PremiumHeader;
