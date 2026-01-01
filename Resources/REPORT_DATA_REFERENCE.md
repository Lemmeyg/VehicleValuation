# Vehicle Valuation Report - Data Reference

This document lists all data points available from the various APIs for designing the report page.

## Table of Contents
- [User Input Data](#user-input-data)
- [VinAudit API Data](#vinaudit-api-data)
- [Auto.dev API Data](#autodev-api-data)
- [CarsXE API Data](#carsxe-api-data)
- [MarketCheck API Data](#marketcheck-api-data)
- [Calculated/Derived Data](#calculatedderived-data)

---

## User Input Data

Data submitted by the user when creating the report.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `vin` | string | Vehicle Identification Number (17 characters) | `"1HGCM82633A123456"` |
| `mileage` | number | Current odometer reading in miles | `50000` |
| `zipCode` | string | 5-digit ZIP code for location-based pricing | `"90210"` |

**Source:** User form submission on `/reports/new`

---

## VinAudit API Data

Vehicle specifications and basic history from VinAudit.

**API Cost:** ~$0.02 per VIN lookup
**Source:** `lib/api/vinaudit-client.ts`
**Storage:** `reports.vehicle_data` (JSONB column)

### Vehicle Specifications

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `vehicle_data.vin` | string | VIN (returned from API) | `"1HGCM82633A123456"` |
| `vehicle_data.year` | string | Model year | `"2020"` |
| `vehicle_data.make` | string | Vehicle manufacturer | `"Honda"` |
| `vehicle_data.model` | string | Vehicle model name | `"Civic"` |
| `vehicle_data.trim` | string? | Trim level (optional) | `"EX"` |
| `vehicle_data.bodyType` | string? | Body style | `"Sedan"` |
| `vehicle_data.engine` | string? | Engine specification | `"2.0L I4"` |
| `vehicle_data.transmission` | string? | Transmission type | `"CVT Automatic"` |
| `vehicle_data.driveType` | string? | Drive configuration | `"FWD"` |
| `vehicle_data.fuelType` | string? | Fuel type | `"Gasoline"` |
| `vehicle_data.cylinders` | string? | Number of cylinders | `"4"` |
| `vehicle_data.mileage` | number? | Mileage (if available from VIN) | `50000` |
| `vehicle_data.color` | string? | Vehicle color (if available) | `"Blue"` |

### Vehicle History Summary

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `vehicle_data.vehicleHistory.accidents` | number? | Number of reported accidents | `1` |
| `vehicle_data.vehicleHistory.owners` | number? | Number of previous owners | `2` |
| `vehicle_data.vehicleHistory.title` | string? | Title status | `"Clean"` / `"Salvage"` / `"Rebuilt"` |

---

## Auto.dev API Data

Detailed accident and damage history.

**API Cost:** Free tier available
**Source:** `lib/api/autodev-client.ts`
**Storage:** `reports.accident_details` (JSONB column)

### Accident Summary

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `accident_details.hasAccidents` | boolean | Whether any accidents reported | `true` |
| `accident_details.totalAccidents` | number | Total count of accidents | `1` |
| `accident_details.accidents` | array | Array of accident detail objects | `[{...}]` |

### Individual Accident Details

Each item in `accident_details.accidents[]`:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `accidentDate` | string? | ISO date of accident | `"2023-06-15"` |
| `location` | string? | Accident location | `"Los Angeles, CA"` |
| `severity` | string? | Severity level | `"minor"` / `"moderate"` / `"severe"` |
| `damageDescription` | string? | Description of damage | `"Front-end collision. Damage to bumper, hood, and right fender."` |
| `estimatedCost` | number? | Estimated repair cost (USD) | `4500` |
| `repaired` | boolean? | Whether damage was repaired | `true` |

---

## CarsXE API Data

Market valuation and comparable vehicles (legacy/alternative source).

**API Cost:** Free tier available
**Source:** `lib/api/carsxe-client.ts`
**Storage:** `reports.valuation_result` (JSONB column)

### Market Valuation Summary

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `valuation_result.averageValue` | number | Average market value (USD) | `18500` |
| `valuation_result.lowValue` | number | Low-end market value (USD) | `15725` |
| `valuation_result.highValue` | number | High-end market value (USD) | `21275` |
| `valuation_result.confidence` | string | Confidence level | `"low"` / `"medium"` / `"high"` |
| `valuation_result.dataPoints` | number | Number of data points used | `127` |

### Comparable Vehicles (CarsXE)

Each item in `valuation_result.comparables[]` (typically 3 vehicles):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `vin` | string? | VIN of comparable | `"1HGCM82633A789012"` |
| `year` | string | Model year | `"2020"` |
| `make` | string | Manufacturer | `"Honda"` |
| `model` | string | Model name | `"Civic"` |
| `trim` | string? | Trim level | `"EX"` |
| `mileage` | number | Odometer reading | `42000` |
| `price` | number | Listing price (USD) | `19500` |
| `location` | string? | Geographic location | `"Los Angeles, CA"` |
| `listingDate` | string? | Date listed | `"2024-11-20"` |
| `source` | string? | Data source | `"CarGurus"` / `"Autotrader"` / `"Cars.com"` |

---

## MarketCheck API Data

**Primary pricing source** - AI-powered price predictions with extensive comparables.

**API Cost:** ~$0.10 per prediction (Premium tier - up to 1,000 comparables)
**Source:** `lib/api/marketcheck-client.ts`
**Storage:** `reports.marketcheck_valuation` (JSONB column)
**Documentation:** https://docs.marketcheck.com/docs/api/cars/market-insights/marketcheck-price

### Price Prediction

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `marketcheck_valuation.predictedPrice` | number | AI-predicted market value (USD) | `22400` |
| `marketcheck_valuation.priceRange.min` | number? | Minimum expected price (USD) | `20160` |
| `marketcheck_valuation.priceRange.max` | number? | Maximum expected price (USD) | `24640` |
| `marketcheck_valuation.confidence` | string | Prediction confidence | `"low"` / `"medium"` / `"high"` |
| `marketcheck_valuation.dataSource` | string | Always "marketcheck" | `"marketcheck"` |
| `marketcheck_valuation.generatedAt` | string | ISO timestamp of generation | `"2024-12-19T10:30:00Z"` |

### Request Parameters (For Reference)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `marketcheck_valuation.requestParams.vin` | string | VIN used for prediction | `"1HGCM82633A123456"` |
| `marketcheck_valuation.requestParams.miles` | number | Mileage used | `50000` |
| `marketcheck_valuation.requestParams.zip` | string | ZIP code used | `"90210"` |
| `marketcheck_valuation.requestParams.dealer_type` | string | Dealer type classification | `"franchise"` / `"independent"` |

### Comparables Metadata

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `marketcheck_valuation.totalComparablesFound` | number | Total matches in database | `847` |
| `marketcheck_valuation.comparablesReturned` | number | Number actually returned (max 10) | `10` |

### Comparable Vehicles (MarketCheck)

Each item in `marketcheck_valuation.comparables[]` (up to 10 vehicles):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `vin` | string? | VIN of comparable vehicle | `"1HGCM82633A789012"` |
| `year` | number | Model year | `2020` |
| `make` | string | Manufacturer | `"Honda"` |
| `model` | string | Model name | `"Civic"` |
| `trim` | string? | Trim level | `"EX"` |
| `miles` | number | Current mileage | `38000` |
| `price` | number | Listed price (USD) | `22800` |
| `dealer_type` | string? | Dealer classification | `"franchise"` / `"independent"` |
| `source` | string | Always "marketcheck" | `"marketcheck"` |

#### Location Details (Nested Object)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `location.city` | string? | City | `"Los Angeles"` |
| `location.state` | string? | State abbreviation | `"CA"` |
| `location.zip` | string? | ZIP code | `"90025"` |
| `location.distance_miles` | number? | Distance from user's ZIP (miles) | `5.2` |

#### Listing Details

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `listing_date` | string? | ISO date listed | `"2024-12-10"` |
| `days_on_market` | number? | Days currently listed | `9` |

---

## Calculated/Derived Data

Data calculated or classified by the application.

**Source:** `lib/utils/dealer-type-classifier.ts`
**Storage:** `reports.dealer_type`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `dealer_type` | string | Classified dealer type for pricing | `"franchise"` / `"independent"` |

**Logic:**
- Luxury brands (BMW, Mercedes-Benz, etc.) → `"franchise"`
- Economy brands older than 10 years → `"independent"`
- Mid-range/newer vehicles → `"franchise"`

---

## Report Metadata

System-generated data about the report itself.

**Source:** `reports` table
**Database Schema:** See `supabase/migrations/`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | uuid | Unique report identifier | `"a413f440-8c13-48d1-b8bb-d001cab952dc"` |
| `user_id` | uuid | User who created report | `"7f8b9c6d-1234-5678-90ab-cdef12345678"` |
| `created_at` | timestamp | Report creation time | `"2024-12-19T10:00:00Z"` |
| `status` | string | Report status | `"draft"` / `"completed"` / `"failed"` |
| `data_retrieval_status` | string | API fetch status | `"pending"` / `"completed"` / `"failed"` |
| `price_paid` | number | Amount paid for report (USD cents) | `2900` (= $29.00) |

---

## Data Availability Notes

### Always Available
- User input data (VIN, mileage, ZIP code)
- Report metadata (ID, dates, status)

### Usually Available (VinAudit)
- Basic vehicle specs (year, make, model)
- Engine, transmission, drive type
- Vehicle history summary

### May Be Missing
- `trim` - Not always identifiable from VIN
- `color` - Rarely available
- `vehicleHistory` - Depends on VIN database completeness
- `accident_details` - Only if Auto.dev has records
- `valuation_result` - CarsXE may not have data for all vehicles
- `marketcheck_valuation` - MarketCheck may return no comparables

### Graceful Degradation Strategy

When designing the report, handle missing data gracefully:

1. **Primary Valuation:** Use MarketCheck if available, fallback to CarsXE
2. **Vehicle Specs:** Show all available fields, skip missing ones
3. **Accident History:** Show "No reported accidents" vs detailed list
4. **Comparables:** Display up to 10 from MarketCheck, or 3 from CarsXE
5. **Price Range:** Calculate from comparables if API doesn't provide

---

## Example Data Structure

Complete example of what a report object might look like:

```typescript
{
  // User inputs
  id: "a413f440-8c13-48d1-b8bb-d001cab952dc",
  vin: "1HGCM82633A123456",
  mileage: 50000,
  zip_code: "90210",

  // VinAudit data
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
    vehicleHistory: {
      accidents: 1,
      owners: 2,
      title: "Clean"
    }
  },

  // Auto.dev data
  accident_details: {
    hasAccidents: true,
    totalAccidents: 1,
    accidents: [{
      accidentDate: "2023-06-15",
      location: "Los Angeles, CA",
      severity: "moderate",
      damageDescription: "Front-end collision. Damage to bumper, hood, and right fender.",
      estimatedCost: 4500,
      repaired: true
    }]
  },

  // MarketCheck data (primary)
  marketcheck_valuation: {
    predictedPrice: 22400,
    priceRange: { min: 20160, max: 24640 },
    confidence: "high",
    dataSource: "marketcheck",
    requestParams: {
      vin: "1HGCM82633A123456",
      miles: 50000,
      zip: "90210",
      dealer_type: "franchise"
    },
    comparables: [
      {
        vin: "1HGCM82633A789012",
        year: 2020,
        make: "Honda",
        model: "Civic",
        trim: "EX",
        miles: 38000,
        price: 22800,
        dealer_type: "franchise",
        location: {
          city: "Los Angeles",
          state: "CA",
          zip: "90025",
          distance_miles: 5.2
        },
        listing_date: "2024-12-10",
        days_on_market: 9,
        source: "marketcheck"
      },
      // ... 9 more comparables
    ],
    totalComparablesFound: 847,
    comparablesReturned: 10,
    generatedAt: "2024-12-19T10:30:00Z"
  },

  // CarsXE data (alternative/legacy)
  valuation_result: {
    averageValue: 18500,
    lowValue: 15725,
    highValue: 21275,
    confidence: "high",
    dataPoints: 127,
    comparables: [
      // 3 comparable vehicles
    ]
  },

  // Derived data
  dealer_type: "franchise",

  // Metadata
  status: "completed",
  data_retrieval_status: "completed",
  price_paid: 2900,
  created_at: "2024-12-19T10:00:00Z"
}
```

---

## UI Design Recommendations

### Hero Section
- Vehicle year, make, model, trim
- VIN (formatted/styled)
- Mileage badge
- Status badges (Clean Title, Accident History, etc.)

### Price Overview
- Large predicted price from MarketCheck
- Price range (min-max)
- Confidence indicator
- Comparison to CarsXE (if available)

### Vehicle Specifications
- Two-column grid layout
- Engine, transmission, drive type, fuel
- Body type, cylinders
- Use icons for each spec

### Accident History
- Timeline view if multiple accidents
- Severity badges (color-coded)
- Repair status indicator
- Estimated costs

### Market Comparables
- Filterable/sortable table or card grid
- Distance sorting (closest first)
- Price comparison to subject vehicle
- Link to location on map (future)

### Vehicle History Summary
- Owners count
- Title status
- Accident count from VinAudit
- Service records (future API)

### Data Sources Footer
- Attribution to APIs used
- Generation timestamp
- Disclaimer about data accuracy

---

**Last Updated:** December 2024
**Version:** 1.0
