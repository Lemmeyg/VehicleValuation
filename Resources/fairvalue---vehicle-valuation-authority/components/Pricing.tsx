import React from 'react';
import { Button } from './ui/Button';
import { Check } from 'lucide-react';
import { PricingPlan } from '../types';

const PLANS: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic Report',
    price: '$29',
    description: 'Essential valuation data for standard vehicles.',
    features: [
      'Comprehensive Market Value Analysis',
      '5 Local Comparable Vehicles',
      'PDF Report Generation',
      'Basic Negotiation Script'
    ]
  },
  {
    id: 'premium',
    name: 'Premium Audit',
    price: '$49',
    description: 'Deep dive analysis including accident history impact.',
    recommended: true,
    features: [
      'Everything in Basic',
      'Accident History Impact Analysis',
      'Diminished Value Calculation',
      'USPAP Compliant Format',
      'Priority Email Support',
      'Money-Back Guarantee'
    ]
  }
];

const Pricing: React.FC = () => {
  return (
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-600 text-lg">
            Invest a small amount to potentially recover thousands more from your insurance settlement.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`relative w-full max-w-md bg-white rounded-2xl p-8 shadow-lg border transition-all duration-300 ${
                plan.recommended 
                  ? 'border-primary-500 ring-4 ring-primary-500/10 scale-105 z-10' 
                  : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0 left-0 -mt-4 flex justify-center">
                  <span className="bg-primary-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
              <p className="text-slate-500 mb-6 min-h-[48px]">{plan.description}</p>
              
              <div className="mb-8">
                <span className="text-5xl font-extrabold text-slate-900">{plan.price}</span>
                <span className="text-slate-500 font-medium">/report</span>
              </div>

              <Button 
                variant={plan.recommended ? 'primary' : 'secondary'} 
                className="w-full mb-8"
              >
                Get Started
              </Button>

              <div className="space-y-4">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-primary-600" />
                    </div>
                    <span className="ml-3 text-slate-600 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-16 text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-4xl mx-auto">
           <h4 className="text-lg font-bold text-slate-900 mb-2">100% Money-Back Guarantee</h4>
           <p className="text-slate-600">
             If our valuation report doesn't show a higher value than your carrier's initial settlement offer, 
             we will refund your purchase in full. No questions asked.
           </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;