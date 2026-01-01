import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { ShieldCheck, Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center cursor-pointer">
            <div className={`p-2 rounded-lg ${isScrolled ? 'bg-primary-50 text-primary-600' : 'bg-white/10 text-white backdrop-blur-sm'}`}>
               <ShieldCheck size={28} />
            </div>
            <span className={`ml-3 text-xl font-bold tracking-tight ${isScrolled ? 'text-slate-900' : 'text-white'}`}>
              FairValue
            </span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-8">
            {['Knowledge Base', 'Directory', 'Valuation Tool', 'Pricing'].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className={`text-sm font-medium hover:text-primary-500 transition-colors ${isScrolled ? 'text-slate-600' : 'text-slate-200 hover:text-white'}`}
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <button className={`text-sm font-medium ${isScrolled ? 'text-slate-600 hover:text-primary-600' : 'text-white hover:text-primary-200'}`}>
              Log In
            </button>
            <Button variant={isScrolled ? 'primary' : 'glass'} size="sm">
              Get Started
            </Button>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={isScrolled ? 'text-slate-900' : 'text-white'}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 p-4 shadow-xl">
          <div className="flex flex-col space-y-4">
            {['Knowledge Base', 'Directory', 'Valuation Tool', 'Pricing'].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="text-slate-600 font-medium px-2 py-2 rounded hover:bg-slate-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3">
              <Button variant="outline" className="w-full justify-center">Log In</Button>
              <Button variant="primary" className="w-full justify-center">Get Started</Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;