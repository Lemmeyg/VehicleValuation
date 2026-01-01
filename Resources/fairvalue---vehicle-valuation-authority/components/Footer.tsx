import React from 'react';
import { ShieldCheck, Twitter, Linkedin, Facebook } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 text-slate-300 py-16 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center mb-6">
              <ShieldCheck className="text-emerald-500 h-8 w-8 mr-2" />
              <span className="text-2xl font-bold text-white">FairValue</span>
            </div>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Empowering vehicle owners with data-driven valuations and expert knowledge to secure fair total loss settlements.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Linkedin size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors"><Facebook size={20} /></a>
            </div>
          </div>

          {/* Links 1 */}
          <div>
            <h4 className="text-white font-semibold mb-6">Knowledge Base</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Negotiation Strategies</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Diminished Value 101</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Total Loss Thresholds</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Insurance Law by State</a></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div>
            <h4 className="text-white font-semibold mb-6">Services</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Basic Valuation Report</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Premium Audit</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Find an Appraiser</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Attorney Directory</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-6">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li>support@fairvalue.com</li>
              <li>1-800-FAIR-VAL</li>
              <li className="pt-4 text-xs text-slate-500">
                Disclaimer: We are not a law firm. Information presented is for educational purposes only.
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
          <p>&copy; 2025 Vehicle Valuation SaaS. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;