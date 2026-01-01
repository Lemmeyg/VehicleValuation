/**
 * PDF Report Template
 *
 * React-PDF template for generating vehicle valuation reports
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getTopListings } from '@/lib/utils/listing-filters'

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #2563eb',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: '40%',
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  value: {
    width: '60%',
    fontSize: 10,
    color: '#1f2937',
  },
  valuationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  valuationBox: {
    flex: 1,
    alignItems: 'center',
  },
  valuationLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 5,
  },
  valuationValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  valuationValueHighlight: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
  },
  guaranteeBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderLeft: '3 solid #16a34a',
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 5,
  },
  guaranteeText: {
    fontSize: 9,
    color: '#166534',
    lineHeight: 1.4,
  },
  metadataBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
  },
  metadataText: {
    fontSize: 8,
    color: '#92400e',
    marginBottom: 2,
  },
  // Comparable vehicles section styles
  comparablesSection: {
    marginBottom: 20,
  },
  comparableCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderLeft: '3 solid #2563eb',
    borderRadius: 4,
  },
  comparableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  comparableTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  comparablePrice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  comparableDetails: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  comparableLocation: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  comparableDistance: {
    fontSize: 8,
    color: '#9ca3af',
  },
})

// Auto.dev VIN Decode Data (from database: autodev_vin_data column)
interface AutoDevVinData {
  vin: string
  vinValid: boolean
  wmi: string
  checkDigit: string
  checksum: boolean
  origin: string
  make: string
  model: string
  trim: string
  style?: string
  body?: string
  type?: string
  engine?: string
  drive?: string
  transmission?: string
  ambiguous?: boolean
  vehicle: {
    vin: string
    year: number
    make: string
    model: string
    manufacturer: string
  }
}

interface MarketCheckComparable {
  vin?: string
  year: number
  make: string
  model: string
  trim?: string
  miles: number
  price: number
  dealer_type?: 'franchise' | 'independent'
  location?: {
    city?: string
    state?: string
    zip?: string
    distance_miles?: number
  }
  listing_date?: string
  days_on_market?: number
  source: string
}

interface MarketCheckValuation {
  predictedPrice: number
  priceRange?: {
    min: number
    max: number
  }
  confidence: 'low' | 'medium' | 'high'
  dataSource: string
  requestParams: {
    vin: string
    miles: number
    zip: string
    dealer_type: 'franchise' | 'independent'
  }
  totalComparablesFound: number
  recentComparables?: {
    num_found: number
    listings: MarketCheckComparable[]
  }
  generatedAt: string
}

interface ReportData {
  vin: string
  reportType: 'BASIC' | 'PREMIUM'
  createdAt: string
  autodevVinData?: AutoDevVinData
  marketcheckValuation?: MarketCheckValuation
}

export const VehicleReportPDF: React.FC<{ data: ReportData }> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatMileage = (miles: number) => {
    return new Intl.NumberFormat('en-US').format(miles)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Get ALL listings from data and filter to top 10 for PDF
  const allListings = data.marketcheckValuation?.recentComparables?.listings || []
  const displayedComparables = getTopListings(allListings, 10)

  // Extract vehicle data from Auto.dev VIN decode
  const vehicleYear = data.autodevVinData?.vehicle?.year
  const vehicleMake = data.autodevVinData?.make
  const vehicleModel = data.autodevVinData?.model
  const vehicleTrim = data.autodevVinData?.trim
  const vehicleBody = data.autodevVinData?.body || data.autodevVinData?.style
  const vehicleEngine = data.autodevVinData?.engine
  const vehicleTransmission = data.autodevVinData?.transmission
  const vehicleDrive = data.autodevVinData?.drive

  // Extract valuation data from MarketCheck
  const predictedPrice = data.marketcheckValuation?.predictedPrice || 0
  const priceMin = data.marketcheckValuation?.priceRange?.min || Math.round(predictedPrice * 0.9)
  const priceMax = data.marketcheckValuation?.priceRange?.max || Math.round(predictedPrice * 1.1)
  const confidence = data.marketcheckValuation?.confidence || 'medium'
  const dataPoints = data.marketcheckValuation?.totalComparablesFound || 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Vehicle Valuation Report</Text>
          <Text style={styles.subtitle}>
            {data.reportType === 'BASIC' ? 'Basic Report' : 'Premium Report'} | Generated on{' '}
            {formatDate(data.createdAt)}
          </Text>
        </View>

        {/* VIN Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Identification</Text>
          <View style={styles.row}>
            <Text style={styles.label}>VIN:</Text>
            <Text style={styles.value}>{data.vin}</Text>
          </View>
        </View>

        {/* Vehicle Information */}
        {data.autodevVinData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            {vehicleYear && (
              <View style={styles.row}>
                <Text style={styles.label}>Year:</Text>
                <Text style={styles.value}>{vehicleYear}</Text>
              </View>
            )}
            {vehicleMake && (
              <View style={styles.row}>
                <Text style={styles.label}>Make:</Text>
                <Text style={styles.value}>{vehicleMake}</Text>
              </View>
            )}
            {vehicleModel && (
              <View style={styles.row}>
                <Text style={styles.label}>Model:</Text>
                <Text style={styles.value}>{vehicleModel}</Text>
              </View>
            )}
            {vehicleTrim && (
              <View style={styles.row}>
                <Text style={styles.label}>Trim:</Text>
                <Text style={styles.value}>{vehicleTrim}</Text>
              </View>
            )}
            {vehicleBody && (
              <View style={styles.row}>
                <Text style={styles.label}>Body Type:</Text>
                <Text style={styles.value}>{vehicleBody}</Text>
              </View>
            )}
            {vehicleEngine && (
              <View style={styles.row}>
                <Text style={styles.label}>Engine:</Text>
                <Text style={styles.value}>{vehicleEngine}</Text>
              </View>
            )}
            {vehicleTransmission && (
              <View style={styles.row}>
                <Text style={styles.label}>Transmission:</Text>
                <Text style={styles.value}>{vehicleTransmission}</Text>
              </View>
            )}
            {vehicleDrive && (
              <View style={styles.row}>
                <Text style={styles.label}>Drive Type:</Text>
                <Text style={styles.value}>{vehicleDrive}</Text>
              </View>
            )}
          </View>
        )}

        {/* Market Valuation */}
        {data.marketcheckValuation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Valuation</Text>
            <View style={styles.valuationContainer}>
              <View style={styles.valuationBox}>
                <Text style={styles.valuationLabel}>Low Range</Text>
                <Text style={styles.valuationValue}>
                  {formatCurrency(priceMin)}
                </Text>
              </View>
              <View style={styles.valuationBox}>
                <Text style={styles.valuationLabel}>Market Value</Text>
                <Text style={styles.valuationValueHighlight}>
                  {formatCurrency(predictedPrice)}
                </Text>
              </View>
              <View style={styles.valuationBox}>
                <Text style={styles.valuationLabel}>High Range</Text>
                <Text style={styles.valuationValue}>
                  {formatCurrency(priceMax)}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Confidence Level:</Text>
              <Text style={styles.value}>{confidence.toUpperCase()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Comparable Vehicles Analyzed:</Text>
              <Text style={styles.value}>{dataPoints.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Comparable Vehicles Section */}
        {displayedComparables.length > 0 && (
          <View style={styles.comparablesSection}>
            <Text style={styles.sectionTitle}>
              Comparable Vehicles (Top {displayedComparables.length} of {allListings.length})
            </Text>
            <Text style={styles.subtitle}>
              Similar vehicles currently listed for sale near you
            </Text>
            {displayedComparables.map((comparable, index) => (
              <View key={index} style={styles.comparableCard}>
                <View style={styles.comparableHeader}>
                  <Text style={styles.comparableTitle}>
                    {comparable.year} {comparable.make} {comparable.model}
                    {comparable.trim && ` ${comparable.trim}`}
                  </Text>
                  <Text style={styles.comparablePrice}>{formatCurrency(comparable.price)}</Text>
                </View>
                <Text style={styles.comparableDetails}>
                  Mileage: {formatMileage(comparable.miles)} miles
                  {comparable.dealer_type && ` • ${comparable.dealer_type} dealer`}
                </Text>
                {comparable.location && (
                  <>
                    <Text style={styles.comparableLocation}>
                      {comparable.location.city}, {comparable.location.state} {comparable.location.zip}
                    </Text>
                    {comparable.location.distance_miles !== undefined && (
                      <Text style={styles.comparableDistance}>
                        {comparable.location.distance_miles.toFixed(1)} miles away
                      </Text>
                    )}
                  </>
                )}
                {(comparable as any).days_on_market && (
                  <Text style={styles.comparableDetails}>
                    Days on market: {(comparable as any).days_on_market}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}


        {/* Money-Back Guarantee */}
        <View style={styles.guaranteeBox}>
          <Text style={styles.guaranteeTitle}>100% Money-Back Guarantee</Text>
          <Text style={styles.guaranteeText}>
            If the insurance settlement falls short of our valuation, request a full refund within
            90 days. We're confident in our valuations and stand behind every report we generate.
          </Text>
        </View>

        {/* Report Metadata */}
        <View style={styles.metadataBox}>
          <Text style={styles.metadataText}>Report Type: {data.reportType}</Text>
          <Text style={styles.metadataText}>Generated: {formatDate(data.createdAt)}</Text>
          <Text style={styles.metadataText}>VIN: {data.vin}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This report is provided for informational purposes only. Vehicle Valuation SaaS is not
            responsible for decisions made based on this information.
          </Text>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Vehicle Valuation SaaS. All rights reserved.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
