import React from 'react';
import { Button } from './ui/Button';
import { MapPin, Star, BadgeCheck } from 'lucide-react';
import { DirectoryItem } from '../types';

const PROS: DirectoryItem[] = [
  {
    id: 1,
    name: "Sarah Jenkins, Esq.",
    role: "Auto Insurance Attorney",
    location: "Chicago, IL",
    rating: 4.9,
    reviewCount: 124,
    image: "https://picsum.photos/100/100?random=10"
  },
  {
    id: 2,
    name: "Elite Auto Appraisals",
    role: "Certified Independent Appraiser",
    location: "Nationwide",
    rating: 5.0,
    reviewCount: 89,
    image: "https://picsum.photos/100/100?random=11"
  },
  {
    id: 3,
    name: "Mark Davis",
    role: "Public Adjuster",
    location: "Miami, FL",
    rating: 4.8,
    reviewCount: 56,
    image: "https://picsum.photos/100/100?random=12"
  }
];

const DirectoryPreview: React.FC = () => {
  return (
    <section id="directory" className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-900/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-emerald-400 font-semibold tracking-wide uppercase text-sm">Professional Network</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-3 mb-6">
            Need more help? Hire a Pro.
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Sometimes you need a heavyweight in your corner. Search our directory of vetted attorneys, 
            independent appraisers, and public adjusters specializing in total loss claims.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {PROS.map((pro) => (
            <div key={pro.id} className="glass-panel p-6 rounded-2xl hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <img src={pro.image} alt={pro.name} className="w-14 h-14 rounded-full border-2 border-emerald-500/30" />
                  <div>
                    <h3 className="text-white font-bold text-lg">{pro.name}</h3>
                    <p className="text-emerald-400 text-sm">{pro.role}</p>
                  </div>
                </div>
                {pro.rating >= 4.9 && <BadgeCheck className="text-blue-400 h-6 w-6" />}
              </div>
              
              <div className="flex items-center gap-4 text-slate-300 text-sm mb-6 border-y border-white/5 py-3">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1 text-slate-500" /> {pro.location}
                </div>
                <div className="flex items-center">
                  <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-500" /> 
                  <span className="font-bold text-white mr-1">{pro.rating}</span> 
                  <span className="text-slate-500">({pro.reviewCount})</span>
                </div>
              </div>

              <Button variant="outline" className="w-full text-sm border-white/20 text-slate-200 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white">
                View Profile
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="primary" size="lg">
            Browse Full Directory
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DirectoryPreview;