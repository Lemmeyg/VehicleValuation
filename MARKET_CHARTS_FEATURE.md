# Market Charts Feature - Documentation

**Date**: December 29, 2025
**Feature**: Interactive Market Distribution & Price Analysis Charts
**Status**: ✅ IMPLEMENTED

---

## Overview

Enhanced the vehicle valuation report with two powerful, interactive data visualizations that provide deep insights into market pricing patterns using live MarketCheck comparable listings data.

---

## Features Implemented

### 1. **Price Distribution Histogram**
**Location**: Left side of Market Distribution section

**What it shows**:
- Distribution of all comparable vehicle prices across 10 price ranges
- Number of vehicles in each price bucket
- Visual indication of where your vehicle sits in the market

**Key Features**:
- ✅ **Live Data**: Uses actual price points from `recentComparables.listings`
- ✅ **Color Coding**:
  - 🟢 **Green bars**: Prices within your vehicle's market range (low-high)
  - 🔵 **Blue bars**: Prices above market range
  - ⚫ **Gray bars**: Prices below market range
- ✅ **Reference Line**: Green dashed line showing your vehicle's estimated value
- ✅ **Interactive Tooltips**: Hover to see exact count in each price range
- ✅ **Auto-scaling**: Automatically adjusts to show full data spread

**Example Insights**:
- Most vehicles priced around $22k-$24k range
- Your vehicle at $23,500 is in the sweet spot
- Only 3 vehicles priced higher than $26k

---

### 2. **Price vs. Mileage Scatter Plot**
**Location**: Right side of Market Distribution section

**What it shows**:
- Relationship between mileage and price for all comparable vehicles
- Each dot represents one actual listing
- Shows how mileage affects market pricing

**Key Features**:
- ✅ **Live Data**: Each point is a real listing from MarketCheck
- ✅ **Color Coding** (same as histogram):
  - 🟢 **Green dots**: Vehicles priced within market range
  - 🔵 **Blue dots**: Vehicles priced above market
  - ⚫ **Gray dots**: Vehicles priced below market
- ✅ **Reference Line**: Horizontal green line at your vehicle's market value
- ✅ **Interactive Tooltips**: Hover to see exact vehicle details (year, make, model, price, mileage)
- ✅ **Smart Axis Scaling**: Automatically adjusts with 10% padding for optimal insight
- ✅ **Pattern Recognition**: Visually shows mileage-price correlation

**Example Insights**:
- Lower mileage vehicles command higher prices
- Sweet spot around 40k miles at $23k-$25k
- Outlier: High-mileage vehicle priced too high

---

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ app/reports/[id]/view/page.tsx (Server Component)  │
│ - Fetches report data from Supabase                │
│ - Extracts allListings from marketcheck_valuation  │
│ - Passes data to MarketCharts                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ components/MarketCharts.tsx (Client Component)      │
│ - Processes listings data                           │
│ - Creates histogram bins                            │
│ - Calculates axis ranges                            │
│ - Renders Recharts visualizations                   │
└─────────────────────────────────────────────────────┘
```

### Files Modified/Created

1. **NEW**: [components/MarketCharts.tsx](components/MarketCharts.tsx)
   - Client component for chart rendering
   - Uses Recharts library
   - Handles all data processing and visualization logic

2. **MODIFIED**: [app/reports/[id]/view/page.tsx](app/reports/[id]/view/page.tsx)
   - Replaced static SVG bell curve with live interactive charts
   - Added `MarketCharts` component import
   - Updated section title to "Market Distribution & Analysis"
   - Now displays count of actual listings used

3. **NEW DEPENDENCY**: `recharts` package
   - Industry-standard React charting library
   - Built on D3.js for robust visualizations
   - Fully responsive and accessible

---

## Data Flow

### From API to Charts

1. **MarketCheck API Call** → Returns `recent_comparables.listings[]`
2. **Stored in Database** → `reports.marketcheck_valuation.recentComparables.listings`
3. **Fetched by Report Page** → `allListings` variable
4. **Passed to MarketCharts** → Component processes and visualizes

### Data Structure Expected

```typescript
listings: Array<{
  price: number        // Required: Vehicle price
  miles: number        // Required: Odometer reading
  year?: number        // Optional: For tooltip display
  make?: string        // Optional: For tooltip display
  model?: string       // Optional: For tooltip display
  trim?: string        // Optional: For tooltip display
}>
```

---

## Smart Features

### 1. **Automatic Histogram Binning**
- Divides price range into 10 equal bins
- Accounts for full data spread (min to max)
- Ensures all listings are represented

### 2. **Dynamic Axis Scaling**
- **Mileage Axis**: Auto-adjusts from min-10% to max+10%
- **Price Axis**: Auto-adjusts from min-10% to max+10%
- Prevents cramped or over-stretched visualizations

### 3. **Color-Coded Insights**
All visualizations use consistent color scheme:
- **Emerald Green (#10b981)**: Within market range (low-high)
- **Blue (#3b82f6)**: Above market range
- **Slate Gray (#94a3b8)**: Below market range

This helps users instantly identify:
- Good deals (green, below market value line)
- Overpriced listings (blue, above market value line)
- Market concentration (where most listings cluster)

### 4. **Responsive Design**
- Charts automatically resize to container width
- Side-by-side on desktop (lg:grid-cols-2)
- Stacked on mobile (grid-cols-1)
- Height fixed at 300px for consistency

---

## User Benefits

### For Vehicle Sellers
1. **Pricing Confidence**: See exactly where your vehicle sits in the market
2. **Competitive Analysis**: Understand how mileage affects pricing
3. **Market Positioning**: Identify if you're priced competitively

### For Vehicle Buyers
1. **Deal Identification**: Spot underpriced listings (green dots below the line)
2. **Overpricing Detection**: Avoid overpriced vehicles (blue dots way above)
3. **Mileage Impact**: Understand price expectations for given mileage

### For Insurance Adjusters
1. **ACV Validation**: Visual confirmation of actual cash value estimate
2. **Comparable Density**: See how many data points support the valuation
3. **Market Spread**: Understand variance in comparable listings

---

## Example Visualizations

### Price Distribution Histogram
```
Number of Vehicles
     12 ┤           ████
     10 ┤       ████████
      8 ┤   ████████████████
      6 ┤████████████████████
      4 ┤████████████████████████
      2 ┤████████████████████████████
      0 └─────────────────────────────
        $18k  $20k  $22k  $24k  $26k
                    ↑ Your Vehicle
```

### Price vs. Mileage Scatter Plot
```
Price
$30k ┤                 •     • (High price, low miles)
     │
$25k ┤     • • •     • • •   (Market cluster)
     │           • •         ─── Market Value Line
$20k ┤ •     • •             (Good deals below line)
     │
$15k ┤   •                   (Outlier)
     └─────────────────────────
      20k   40k   60k   80k   Mileage
```

---

## Performance Considerations

### Client-Side Rendering
- Charts are client components (`'use client'`)
- Necessary because Recharts requires browser DOM APIs
- Data is passed from server component (pre-fetched)

### Data Processing
- Histogram binning: O(n) where n = number of listings
- Scatter plot: Direct mapping, O(n)
- Efficient even with 100+ listings

### Bundle Size
- Recharts: ~85KB gzipped (reasonable for the value provided)
- Only loaded on report view page (code-split by Next.js)

---

## Future Enhancements

### Potential Additions
1. **Trend Lines**: Add linear regression line to scatter plot
2. **Filtering**: Allow users to filter by dealer type, location, etc.
3. **Export**: Download charts as PNG/PDF
4. **Comparison Mode**: Overlay multiple vehicle reports
5. **Time Series**: Show how pricing has changed over time
6. **Days on Market**: Third chart showing DOM vs. price correlation

### Advanced Analytics
1. **Price Prediction**: ML-based price suggestions based on cluster patterns
2. **Deal Score**: Automated scoring (0-100) based on position in market
3. **Market Heat Map**: Geographic visualization of pricing variations

---

## Testing Recommendations

### Test Cases

1. **Normal Case**: 20-50 listings
   - ✅ Verify histogram shows good distribution
   - ✅ Verify scatter plot shows clear mileage-price relationship
   - ✅ Check tooltips display correctly

2. **Edge Case: Few Listings** (1-5 listings)
   - ✅ Charts should still render
   - ✅ Bins may be sparse (expected)
   - ✅ No errors or layout breaks

3. **Edge Case: Many Listings** (100+ listings)
   - ✅ Performance should remain smooth
   - ✅ Charts should not feel cramped
   - ✅ Tooltips should work on all points

4. **Edge Case: No Listings**
   - ✅ Fallback message: "No comparable listings available for visualization"
   - ✅ No chart rendering errors

5. **Mobile Responsiveness**
   - ✅ Charts stack vertically on small screens
   - ✅ Touch interactions work (tooltips)
   - ✅ Text remains readable

---

## Code Examples

### Using the Component

```tsx
import { MarketCharts } from '@/components/MarketCharts'

// In your page/component
<MarketCharts
  listings={allListings}
  estimatedValue={estimatedValue}
  lowRange={lowRange}
  highRange={highRange}
/>
```

### Expected Props

```typescript
interface MarketChartsProps {
  listings: Array<{
    price: number
    miles: number
    year?: number
    make?: string
    model?: string
    trim?: string
  }>
  estimatedValue: number  // Your vehicle's market value
  lowRange: number        // Low end of market range
  highRange: number       // High end of market range
}
```

---

## Troubleshooting

### Charts Not Displaying
**Problem**: Blank space where charts should be
**Solution**:
1. Check if `allListings.length > 0`
2. Verify listings have `price` and `miles` fields
3. Check browser console for Recharts errors

### Colors Look Wrong
**Problem**: All bars/dots same color
**Solution**: Verify `lowRange`, `highRange`, and `estimatedValue` are valid numbers

### Tooltips Not Working
**Problem**: Hover shows no tooltip
**Solution**:
1. Ensure component is client-side (`'use client'`)
2. Check if browser supports hover events (works on desktop)
3. On mobile, try tapping instead of hovering

### Axis Labels Cramped
**Problem**: Labels overlap or hard to read
**Solution**: This is handled automatically by Recharts, but you can adjust `fontSize` in the axis `tick` prop

---

## Deployment Checklist

- [x] Install recharts package (`npm install recharts`)
- [x] Create MarketCharts component
- [x] Update report view page
- [x] Test with real MarketCheck data
- [ ] Verify on mobile devices
- [ ] Check print/PDF rendering (charts may not appear in PDF)
- [ ] Performance test with 100+ listings
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

---

## References

- **Recharts Documentation**: https://recharts.org/
- **MarketCheck API**: See `lib/api/marketcheck-client.ts`
- **Data Structure**: See `MARKETCHECK_DATA_STRUCTURE_UPDATE.md`

---

**Last Updated**: December 29, 2025
**Component Version**: 1.0
**Dependencies**: recharts ^2.x
