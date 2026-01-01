import React from 'react';
import { Button } from './ui/Button';
import { ArrowRight, BookOpen } from 'lucide-react';

const KnowledgeBasePreview: React.FC = () => {
  return (
    <section id="knowledge-base" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Empower Yourself with Knowledge</h2>
            <p className="text-slate-600 text-lg">
              Browse our extensive library of articles, templates, and guides written by former insurance adjusters and appraisers.
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <Button variant="outline" className="group">
              View All Articles <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Featured Article Large */}
          <div className="relative rounded-2xl overflow-hidden group cursor-pointer h-full min-h-[400px]">
            <img 
              src="https://picsum.photos/800/600" 
              alt="Car inspection" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
            
            <div className="absolute bottom-0 left-0 p-8">
              <span className="inline-block px-3 py-1 bg-primary-600 text-white text-xs font-bold uppercase tracking-wider rounded-full mb-4">
                Essential Guide
              </span>
              <h3 className="text-2xl font-bold text-white mb-3">
                The Ultimate Guide to Negotiating a Total Loss
              </h3>
              <p className="text-slate-200 mb-6 line-clamp-2">
                Learn the specific language adjusters use, how to present your counter-valuation, and when to invoke the appraisal clause in your policy.
              </p>
              <span className="text-white font-medium flex items-center text-sm group-hover:text-primary-300 transition-colors">
                Read Article <ArrowRight className="ml-2 h-4 w-4" />
              </span>
            </div>
          </div>

          {/* List of other articles */}
          <div className="flex flex-col space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-6 p-6 rounded-2xl border border-slate-100 hover:border-primary-100 hover:shadow-md transition-all cursor-pointer group bg-white">
                <div className="h-24 w-24 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden">
                   <img src={`https://picsum.photos/200/200?random=${i}`} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-3 w-3 text-primary-600" />
                    <span className="text-xs font-semibold text-primary-600 uppercase">Valuation Tip</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary-700 transition-colors">
                    {i === 1 ? "What to do if you owe more than the offer" : i === 2 ? "How to find comparable vehicles locally" : "Understanding State Taxes and Fees"}
                  </h4>
                  <p className="text-slate-500 text-sm line-clamp-1">
                    Don't let the insurance company ignore sales tax and registration fees in your final settlement check.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default KnowledgeBasePreview;