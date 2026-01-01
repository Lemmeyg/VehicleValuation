import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { Article } from '../types';

const TOP_ARTICLES: Article[] = [
  {
    id: 1,
    title: "How to Dispute a Total Loss Valuation",
    excerpt: "Insurance carriers often use automated systems that undervalue vehicles. Learn the 3 steps to fight back.",
    category: "Negotiation Strategy",
    readTime: "5 min read"
  },
  {
    id: 2,
    title: "Understanding Diminished Value Claims",
    excerpt: "Even after repairs, your car is worth less. Discover if you are owed thousands in diminished value.",
    category: "Claim Education",
    readTime: "4 min read"
  },
  {
    id: 3,
    title: "The 'Actual Cash Value' Myth",
    excerpt: "Why the check they offered you isn't actually replacement cost, and how to prove the real market value.",
    category: "Valuation Basics",
    readTime: "6 min read"
  }
];

const Hero: React.FC = () => {
  const [activeArticleIndex, setActiveArticleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveArticleIndex((prev) => (prev + 1) % TOP_ARTICLES.length);
    }, 5000); // Cycle every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center bg-slate-900 pt-20 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-900/40 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-blue-900/20 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Value Prop */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-900/30 border border-primary-700/50 text-primary-300 text-sm font-medium mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary-400"></span>
              <span>Trusted by 10,000+ vehicle owners</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              Don't Settle for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-emerald-200">
                Less Than Fair Value
              </span>
            </h1>
            
            <p className="text-lg text-slate-300 mb-8 leading-relaxed max-w-lg">
              Insurance carriers are experts at paying the minimum. 
              We arm you with professional data, expert knowledge, and legal connections to ensure you get paid what your vehicle is actually worth.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="group">
                Get Your Valuation Report
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="glass" size="lg">
                Find a Professional
              </Button>
            </div>

            <div className="mt-8 flex items-center space-x-6 text-slate-400 text-sm">
              <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-primary-500" /> Data-Backed</div>
              <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-primary-500" /> Expert Reviewed</div>
              <div className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-primary-500" /> Lawyer Approved</div>
            </div>
          </div>

          {/* Right Column: Dynamic Knowledge Cards */}
          <div className="relative hidden lg:block h-[500px]">
             {/* The Card Stack Visual */}
             <div className="absolute inset-0 flex items-center justify-center">
                {TOP_ARTICLES.map((article, index) => {
                  const isActive = index === activeArticleIndex;
                  const isNext = index === (activeArticleIndex + 1) % TOP_ARTICLES.length;
                  
                  let transformClass = 'scale-90 opacity-0 translate-y-8 z-0';
                  if (isActive) transformClass = 'scale-100 opacity-100 translate-y-0 z-20';
                  if (isNext) transformClass = 'scale-95 opacity-40 -translate-y-4 z-10 blur-[1px]';

                  return (
                    <div 
                      key={article.id}
                      className={`absolute w-full max-w-md transition-all duration-700 ease-in-out ${transformClass}`}
                    >
                      <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden group hover:border-primary-500/30 transition-colors cursor-pointer">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <BookOpen size={120} className="text-white" />
                        </div>
                        
                        <div className="relative z-10">
                          <span className="text-primary-400 text-xs font-bold tracking-wider uppercase mb-2 block">
                            Trending in Knowledge Base
                          </span>
                          <h3 className="text-2xl font-bold text-white mb-3 leading-snug">
                            {article.title}
                          </h3>
                          <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                            {article.excerpt}
                          </p>
                          
                          <div className="flex justify-between items-center border-t border-white/10 pt-4">
                            <span className="text-slate-400 text-xs bg-slate-800 px-2 py-1 rounded">
                              {article.category}
                            </span>
                            <span className="text-slate-400 text-xs">
                              {article.readTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
             </div>
             
             {/* Carousel Indicators */}
             <div className="absolute bottom-10 left-0 right-0 flex justify-center space-x-2 z-30">
                {TOP_ARTICLES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveArticleIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === activeArticleIndex ? 'w-8 bg-primary-500' : 'w-2 bg-slate-600 hover:bg-slate-500'
                    }`}
                  />
                ))}
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;