
export interface VehicleData {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim?: string;
  bodyType?: string;
  engine?: string;
  transmission?: string;
  driveType?: string;
  fuelType?: string;
  cylinders?: string;
  mileage?: number;
  color?: string;
  vehicleHistory: {
    accidents: number;
    owners: number;
    title: string;
  };
}

export interface AccidentDetail {
  accidentDate?: string;
  location?: string;
  severity?: string;
  damageDescription?: string;
  estimatedCost?: number;
  repaired?: boolean;
}

export interface ValuationResult {
  averageValue: number;
  lowValue: number;
  highValue: number;
  confidence: 'low' | 'medium' | 'high';
  dataPoints: number;
  comparables: ComparableVehicle[];
}

export interface ComparableVehicle {
  vin?: string;
  year: number | string;
  make: string;
  model: string;
  trim?: string;
  mileage?: number;
  miles?: number; // for marketcheck
  price: number;
  location?: string | { city: string; state: string; zip: string; distance_miles?: number };
  listingDate?: string;
  listing_date?: string; // for marketcheck
  source: string;
  days_on_market?: number;
}

export interface MarketCheckValuation {
  predictedPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  confidence: string;
  totalComparablesFound: number;
  comparables: ComparableVehicle[];
}

export interface ReportData {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  price_paid: number;
  vin: string;
  mileage: number;
  zipCode: string;
  vehicle_data: VehicleData;
  accident_details: {
    hasAccidents: boolean;
    totalAccidents: number;
    accidents: AccidentDetail[];
  };
  valuation_result: ValuationResult;
  marketcheck_valuation: MarketCheckValuation;
  dealer_type: string;
}
