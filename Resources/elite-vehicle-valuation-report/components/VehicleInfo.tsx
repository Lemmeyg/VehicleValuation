
import React from 'react';
import { VehicleData } from '../types';

interface VehicleInfoProps {
  vehicle: VehicleData;
}

const VehicleInfo: React.FC<VehicleInfoProps> = ({ vehicle }) => {
  const specs = [
    { label: 'Year', value: vehicle.year },
    { label: 'Make', value: vehicle.make },
    { label: 'Model', value: vehicle.model },
    { label: 'Trim', value: vehicle.trim || 'N/A' },
    { label: 'Body Style', value: vehicle.bodyType || 'N/A' },
    { label: 'Engine', value: vehicle.engine || 'N/A' },
    { label: 'Transmission', value: vehicle.transmission || 'N/A' },
    { label: 'Drive Type', value: vehicle.driveType || 'N/A' },
    { label: 'Fuel Type', value: vehicle.fuelType || 'N/A' },
    { label: 'Color', value: vehicle.color || 'N/A' },
  ];

  return (
    <div className="glass-card rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-100 rounded-lg">
          <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Vehicle Specifications</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
        {specs.map((spec, idx) => (
          <div key={idx} className="space-y-1">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">{spec.label}</p>
            <p className="text-sm font-semibold text-slate-900">{spec.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="p-3 bg-slate-100 rounded-full text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Odometer</p>
            <p className="text-lg font-bold text-slate-900">{vehicle.mileage?.toLocaleString()} mi</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="p-3 bg-slate-100 rounded-full text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Title Status</p>
            <p className="text-lg font-bold text-green-600">{vehicle.vehicleHistory.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="p-3 bg-slate-100 rounded-full text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Owners</p>
            <p className="text-lg font-bold text-slate-900">{vehicle.vehicleHistory.owners}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleInfo;
