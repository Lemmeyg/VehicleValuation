import React from 'react';
import { BarChart3, Clock, Scale, Shield, FileText, Search } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <BarChart3 className="h-6 w-6 text-emerald-600" />,
      title: "Market Valuation Analysis",
      description: "We use the same databases insurers use, plus real market listings, to prove your car is worth more."
    },
    {
      icon: <Clock className="h-6 w-6 text-emerald-600" />,
      title: "24-48 Hour Turnaround",
      description: "Get your comprehensive PDF report quickly so you can respond to the carrier's offer immediately."
    },
    {
      icon: <Scale className="h-6 w-6 text-emerald-600" />,
      title: "Total Loss Negotiation",
      description: "Step-by-step guides and scripts to handle the adjuster's objections like a pro."
    },
    {
      icon: <Shield className="h-6 w-6 text-emerald-600" />,
      title: "Money-Back Guarantee",
      description: "If we can't find a higher value for your vehicle than their initial offer, the report is free."
    },
    {
      icon: <Search className="h-6 w-6 text-emerald-600" />,
      title: "Diminished Value",
      description: "Not totaled? We calculate exactly how much value your car lost due to the accident history."
    },
    {
      icon: <FileText className="h-6 w-6 text-emerald-600" />,
      title: "Court-Ready Documents",
      description: "Our reports comply with USPAP standards and can be used in small claims court if necessary."
    }
  ];

  return (
    <section id="features" className="py-24 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-primary-600 font-semibold tracking-wide uppercase text-sm mb-3">Why Choose FairValue</h2>
          <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Everything you need to challenge the insurance carrier
          </h3>
          <p className="text-slate-600 text-lg">
            Insurance companies have teams of adjusters and sophisticated software designed to minimize payouts. 
            We level the playing field.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary-100 transition-colors">
                {feature.icon}
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h4>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;