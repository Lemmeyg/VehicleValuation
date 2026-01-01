
import { ReportData } from '../types';

export const mockReport: ReportData = {
  id: "a413f440-8c13-48d1-b8bb-d001cab952dc",
  user_id: "7f8b9c6d-1234-5678-90ab-cdef12345678",
  created_at: "2024-12-19T10:00:00Z",
  status: "completed",
  price_paid: 2900,
  vin: "1HGCM82633A123456",
  mileage: 50000,
  zipCode: "90210",
  dealer_type: "franchise",
  vehicle_data: {
    vin: "1HGCM82633A123456",
    year: "2020",
    make: "Honda",
    model: "Civic",
    trim: "EX",
    bodyType: "Sedan",
    engine: "2.0L I4",
    transmission: "CVT Automatic",
    driveType: "FWD",
    fuelType: "Gasoline",
    cylinders: "4",
    mileage: 50000,
    color: "Modern Steel Metallic",
    vehicleHistory: {
      accidents: 1,
      owners: 2,
      title: "Clean"
    }
  },
  accident_details: {
    hasAccidents: true,
    totalAccidents: 1,
    accidents: [
      {
        accidentDate: "2023-06-15",
        location: "Los Angeles, CA",
        severity: "Moderate",
        damageDescription: "Front-end collision. Damage to bumper, hood, and right fender. Structural integrity verified post-repair.",
        estimatedCost: 4500,
        repaired: true
      }
    ]
  },
  valuation_result: {
    averageValue: 18500,
    lowValue: 15725,
    highValue: 21275,
    confidence: 'high',
    dataPoints: 127,
    comparables: [
      {
        vin: "1HGCM82633A789012",
        year: "2020",
        make: "Honda",
        model: "Civic",
        trim: "EX",
        mileage: 42000,
        price: 19500,
        location: "Los Angeles, CA",
        listingDate: "2024-11-20",
        source: "Cars.com"
      },
      {
        year: "2020",
        make: "Honda",
        model: "Civic",
        trim: "LX",
        mileage: 55000,
        price: 17200,
        location: "Santa Monica, CA",
        listingDate: "2024-11-15",
        source: "CarGurus"
      },
      {
        year: "2020",
        make: "Honda",
        model: "Civic",
        trim: "EX",
        mileage: 48000,
        price: 18900,
        location: "Long Beach, CA",
        listingDate: "2024-11-25",
        source: "Autotrader"
      }
    ]
  },
  marketcheck_valuation: {
    predictedPrice: 22400,
    priceRange: {
      min: 20160,
      max: 24640
    },
    confidence: "high",
    totalComparablesFound: 847,
    comparables: [
      { year: 2020, make: "Honda", model: "Civic", trim: "EX", miles: 38000, price: 22800, location: { city: "Los Angeles", state: "CA", zip: "90025" }, listing_date: "2024-12-10", source: "marketcheck" },
      { year: 2020, make: "Honda", model: "Civic", trim: "EX-L", miles: 41000, price: 21500, location: { city: "Pasadena", state: "CA", zip: "91101" }, listing_date: "2024-12-05", source: "marketcheck" },
      { year: 2020, make: "Honda", model: "Civic", trim: "EX", miles: 52000, price: 18200, location: { city: "Irvine", state: "CA", zip: "92602" }, listing_date: "2024-12-12", source: "marketcheck" },
      { year: 2020, make: "Honda", model: "Civic", trim: "Sport", miles: 45000, price: 19900, location: { city: "Torrance", state: "CA", zip: "90501" }, listing_date: "2024-12-08", source: "marketcheck" },
      { year: 2020, make: "Honda", model: "Civic", trim: "EX", miles: 33000, price: 23100, location: { city: "Burbank", state: "CA", zip: "91501" }, listing_date: "2024-12-14", source: "marketcheck" },
      { year: 2020, make: "Honda", model: "Civic", trim: "LX", miles: 60000, price: 16500, location: { city: "Glendale", state: "CA", zip: "91201" }, listing_date: "2024-12-01", source: "marketcheck" },
      { year: 2020, make: "Honda", model: "Civic", trim: "EX", miles: 49000, price: 18700, location: { city: "Anaheim", state: "CA", zip: "92801" }, listing_date: "2024-12-11", source: "marketcheck" }
    ]
  }
};
