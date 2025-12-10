// Database types will be auto-generated from Supabase
// This file contains application-specific types

export interface VehicleData {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
  mileage: number
  condition?: 'excellent' | 'good' | 'fair' | 'poor'
  color?: string
  previousAccidents?: boolean
}

export interface AccidentDetails {
  accidentDate?: string
  location?: string
  description?: string
  acvReportUrl?: string
}

export interface ComparableVehicle {
  id: string
  price: number
  mileage: number
  year: number
  make: string
  model: string
  trim?: string
  location: string
  listingUrl?: string
  notes: string // Explanation of price differences
  source: 'autodev' | 'carsxe' | 'vinaudit'
}

export interface ValuationResult {
  averageValue: number
  lowValue: number
  highValue: number
  comparables: ComparableVehicle[]
  generatedAt: string
}

export interface Report {
  id: string
  userId: string
  vin: string
  vehicleData: VehicleData
  accidentDetails?: AccidentDetails
  valuationResult?: ValuationResult
  status: 'draft' | 'pending' | 'completed' | 'failed'
  pricePaid: number
  pdfUrl?: string
  createdAt: string
  updatedAt: string
}

export interface PaymentIntent {
  reportId: string
  amount: number
  priceOption: 29 | 49
}

export interface RefundRequest {
  id: string
  reportId: string
  userId: string
  carrierOfferAmount: number
  finalSettlementAmount: number
  acvReportUrl: string
  settlementReportUrl: string
  status: 'pending' | 'approved' | 'denied'
  adminNotes?: string
}
