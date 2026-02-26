/**
 * PDF Report Template
 *
 * React-PDF template that matches the browser report view layout
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer'
import { getLowestDOSActiveListings, getListingsStats } from '@/lib/utils/listing-filters'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },

  // ── HEADER ──────────────────────────────────────────────────
  headerBreadcrumb: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerDate: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 8,
  },
  headerVin: {
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Courier',
    marginBottom: 12,
  },
  headerDivider: {
    borderBottom: '2 solid #2563eb',
    marginBottom: 20,
  },

  // ── MARKET VALUE CARDS ──────────────────────────────────────
  cardsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  card: {
    flex: 1,
    padding: 12,
    border: '1 solid #e2e8f0',
    borderRadius: 4,
    marginRight: 8,
  },
  cardLast: {
    marginRight: 0,
  },
  cardBorderLow: {
    borderLeft: '4 solid #94a3b8',
  },
  cardBorderMarket: {
    borderLeft: '4 solid #10b981',
  },
  cardBorderHigh: {
    borderLeft: '4 solid #3b82f6',
  },
  cardLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 4,
  },
  cardLabelGreen: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  cardLabelBlue: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 3,
  },
  cardSubtext: {
    fontSize: 7,
    color: '#94a3b8',
  },

  // ── SECTION WRAPPER ─────────────────────────────────────────
  sectionBox: {
    border: '1 solid #e2e8f0',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  sectionBoxAlt: {
    backgroundColor: '#f8fafc',
    border: '1 solid #e2e8f0',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sectionBadge: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  sectionSubtext: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 12,
  },

  // ── VEHICLE SPECS GRID ──────────────────────────────────────
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specItem: {
    width: '33.33%',
    marginBottom: 12,
    paddingRight: 8,
  },
  specLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  // ── MARKET ANALYSIS STATS ───────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  chartsNote: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 12,
  },

  // ── VALUE BOXES (inside Market Analysis) ────────────────────
  valueBoxesRow: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTop: '1 solid #e2e8f0',
  },
  valueBoxLow: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    alignItems: 'center',
    marginRight: 6,
  },
  valueBoxMarket: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f0fdf4',
    border: '2 solid #bbf7d0',
    borderRadius: 4,
    alignItems: 'center',
    marginRight: 6,
  },
  valueBoxHigh: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    alignItems: 'center',
  },
  valueBoxLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 4,
  },
  valueBoxLabelGreen: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  valueBoxAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  valueBoxAmountGreen: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#047857',
  },

  // ── COMPARABLES TABLE ────────────────────────────────────────
  tableStatsRight: {
    alignItems: 'flex-end',
  },
  tableStatsText: {
    fontSize: 8,
    color: '#64748b',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '2 solid #e2e8f0',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottom: '1 solid #f1f5f9',
    alignItems: 'flex-start',
  },
  colVehicle: { width: '38%', paddingRight: 6 },
  colMileage: { width: '14%', paddingRight: 4 },
  colPrice: { width: '15%', paddingRight: 4 },
  colDays: { width: '13%', paddingRight: 4 },
  colDealer: { width: '20%' },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  vehicleNameText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 1,
  },
  vehicleTrimText: {
    fontSize: 7,
    color: '#64748b',
  },
  tableBodyText: {
    fontSize: 8,
    color: '#475569',
  },
  priceGreenText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#059669',
  },
  dealerLinkStyle: {
    fontSize: 7,
    color: '#2563eb',
    textDecoration: 'underline',
  },
  dealerPlainStyle: {
    fontSize: 7,
    color: '#475569',
  },

  // ── ADDITIONAL VALUATION CONSIDERATIONS ─────────────────────
  considTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  considIntro: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 1.4,
  },
  considPara: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  boldInline: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  considRecommend: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    lineHeight: 1.4,
    paddingTop: 8,
    borderTop: '1 solid #cbd5e1',
    marginTop: 8,
  },

  // ── GUARANTEE BOX ────────────────────────────────────────────
  guaranteeBox: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderLeft: '3 solid #16a34a',
    borderRadius: 2,
  },
  guaranteeTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 5,
  },
  guaranteeText: {
    fontSize: 8,
    color: '#166534',
    lineHeight: 1.4,
  },

  // ── DISCLAIMER ───────────────────────────────────────────────
  disclaimerText: {
    fontSize: 7,
    color: '#94a3b8',
    lineHeight: 1.4,
    marginBottom: 8,
  },
  disclaimerFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTop: '1 solid #e2e8f0',
    marginTop: 8,
  },
  disclaimerFooterText: {
    fontSize: 7,
    color: '#94a3b8',
  },
})

// Auto.dev VIN Decode Data
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
  mileage?: number
  price: number
  dealer_type?: 'franchise' | 'independent'
  dealer_name?: string
  vdp_url?: string
  photo_url?: string
  dos_active?: number
  dom?: number
  dom_180?: number
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
  id: string
  vin: string
  mileage?: number
  reportType: 'BASIC' | 'PREMIUM'
  createdAt: string
  autodevVinData?: AutoDevVinData
  marketcheckValuation?: MarketCheckValuation
}

export const VehicleReportPDF: React.FC<{ data: ReportData }> = ({ data }) => {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)

  const formatMileage = (miles: number) => new Intl.NumberFormat('en-US').format(miles)

  const formatDateShort = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })

  // Listings
  const allListings = data.marketcheckValuation?.recentComparables?.listings || []
  const displayedComparables = getLowestDOSActiveListings(allListings, 10)
  const stats = getListingsStats(allListings)

  // Vehicle data
  const vehicleYear = data.autodevVinData?.vehicle?.year
  const vehicleMake = data.autodevVinData?.make
  const vehicleModel = data.autodevVinData?.model
  const vehicleTrim = data.autodevVinData?.trim
  const vehicleBody = data.autodevVinData?.body || data.autodevVinData?.style
  const vehicleEngine = data.autodevVinData?.engine
  const vehicleTransmission = data.autodevVinData?.transmission
  const vehicleDrive = data.autodevVinData?.drive
  const vehicleType = data.autodevVinData?.type
  const vehicleOrigin = data.autodevVinData?.origin

  // Valuation
  const estimatedValue = data.marketcheckValuation?.predictedPrice || 0
  const lowRange = data.marketcheckValuation?.priceRange?.min || Math.round(estimatedValue * 0.9)
  const highRange = data.marketcheckValuation?.priceRange?.max || Math.round(estimatedValue * 1.1)
  const confidence = data.marketcheckValuation?.confidence || 'medium'

  const reportIdShort = data.id ? data.id.substring(0, 8).toUpperCase() : ''

  const confidenceBadgeColor =
    confidence === 'high' ? '#059669' : confidence === 'medium' ? '#2563eb' : '#d97706'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── HEADER ───────────────────────────────────────── */}
        <View>
          <Text style={styles.headerBreadcrumb}>TOTALLOSSTOOLKIT REPORT › ID: {reportIdShort}</Text>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>
              {vehicleYear} {vehicleMake} {vehicleModel}
            </Text>
            <Text style={styles.headerDate}>Report Date: {formatDateShort(data.createdAt)}</Text>
          </View>
          <Text style={styles.headerVin}>{data.vin}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* ── MARKET VALUE CARDS ───────────────────────────── */}
        <View style={styles.cardsRow}>
          <View style={[styles.card, styles.cardBorderLow]}>
            <Text style={styles.cardLabel}>LOW RANGE</Text>
            <Text style={styles.cardValue}>{formatCurrency(lowRange)}</Text>
            <Text style={styles.cardSubtext}>Market floor estimate</Text>
          </View>
          <View style={[styles.card, styles.cardBorderMarket]}>
            <Text style={styles.cardLabelGreen}>MARKET VALUE</Text>
            <Text style={styles.cardValue}>{formatCurrency(estimatedValue)}</Text>
            <Text style={styles.cardSubtext}>{confidence.toUpperCase()} CONFIDENCE</Text>
          </View>
          <View style={[styles.card, styles.cardBorderHigh, styles.cardLast]}>
            <Text style={styles.cardLabelBlue}>HIGH RANGE</Text>
            <Text style={styles.cardValue}>{formatCurrency(highRange)}</Text>
            <Text style={styles.cardSubtext}>Market ceiling estimate</Text>
          </View>
        </View>

        {/* ── VEHICLE SPECIFICATIONS ───────────────────────── */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Vehicle Specifications</Text>
          </View>
          <View style={styles.specsGrid}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>YEAR</Text>
              <Text style={styles.specValue}>{vehicleYear || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>MAKE</Text>
              <Text style={styles.specValue}>{vehicleMake || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>MILEAGE</Text>
              <Text style={styles.specValue}>
                {data.mileage ? `${data.mileage.toLocaleString()} mi` : 'N/A'}
              </Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>MODEL</Text>
              <Text style={styles.specValue}>{vehicleModel || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>TRIM</Text>
              <Text style={styles.specValue}>{vehicleTrim || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>BODY STYLE</Text>
              <Text style={styles.specValue}>{vehicleBody || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>ENGINE</Text>
              <Text style={styles.specValue}>{vehicleEngine || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>TRANSMISSION</Text>
              <Text style={styles.specValue}>{vehicleTransmission || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>DRIVE TYPE</Text>
              <Text style={styles.specValue}>{vehicleDrive || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>VEHICLE TYPE</Text>
              <Text style={styles.specValue}>{vehicleType || 'N/A'}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>ORIGIN</Text>
              <Text style={styles.specValue}>{vehicleOrigin || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* ── MARKET DISTRIBUTION & ANALYSIS ──────────────── */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Market Distribution & Analysis</Text>
            <Text style={[styles.sectionBadge, { color: confidenceBadgeColor }]}>
              CONFIDENCE: {confidence.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.sectionSubtext}>
            Based on {allListings.length} live comparable listings from recent market data
          </Text>

          {allListings.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>TOTAL ANALYZED</Text>
                <Text style={styles.statValue}>{allListings.length}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>AVG PRICE</Text>
                <Text style={styles.statValue}>{formatCurrency(Math.round(stats.avgPrice))}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>LOWEST</Text>
                <Text style={styles.statValue}>{formatCurrency(stats.minPrice)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>HIGHEST</Text>
                <Text style={styles.statValue}>{formatCurrency(stats.maxPrice)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>FRANCHISE</Text>
                <Text style={styles.statValue}>{stats.franchiseCount}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>INDEPENDENT</Text>
                <Text style={styles.statValue}>{stats.independentCount}</Text>
              </View>
            </View>
          )}

          <Text style={styles.chartsNote}>
            Interactive price distribution charts are available in the online report view
          </Text>

          <View style={styles.valueBoxesRow}>
            <View style={styles.valueBoxLow}>
              <Text style={styles.valueBoxLabel}>LOW RANGE</Text>
              <Text style={styles.valueBoxAmount}>{formatCurrency(lowRange)}</Text>
            </View>
            <View style={styles.valueBoxMarket}>
              <Text style={styles.valueBoxLabelGreen}>FAIR MARKET VALUE</Text>
              <Text style={styles.valueBoxAmountGreen}>{formatCurrency(estimatedValue)}</Text>
            </View>
            <View style={styles.valueBoxHigh}>
              <Text style={styles.valueBoxLabel}>HIGH RANGE</Text>
              <Text style={styles.valueBoxAmount}>{formatCurrency(highRange)}</Text>
            </View>
          </View>
        </View>

        {/* ── MARKET COMPARABLES ───────────────────────────── */}
        {displayedComparables.length > 0 && (
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Market Comparables</Text>
              <View style={styles.tableStatsRight}>
                <Text style={styles.tableStatsText}>
                  Showing {displayedComparables.length} most recent of {allListings.length} listings
                </Text>
                {stats.avgPrice > 0 && (
                  <Text style={styles.tableStatsText}>
                    Avg: {formatCurrency(Math.round(stats.avgPrice))} • Range:{' '}
                    {formatCurrency(stats.minPrice)} - {formatCurrency(stats.maxPrice)}
                  </Text>
                )}
              </View>
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.colVehicle}>
                <Text style={styles.tableHeaderText}>VEHICLE DETAILS</Text>
              </View>
              <View style={styles.colMileage}>
                <Text style={styles.tableHeaderText}>MILEAGE</Text>
              </View>
              <View style={styles.colPrice}>
                <Text style={styles.tableHeaderText}>MARKET PRICE</Text>
              </View>
              <View style={styles.colDays}>
                <Text style={styles.tableHeaderText}>DAYS ON MKT</Text>
              </View>
              <View style={styles.colDealer}>
                <Text style={styles.tableHeaderText}>DEALER</Text>
              </View>
            </View>

            {/* Table Rows */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {displayedComparables.map((comp: any, idx: number) => {
              const compMiles = (comp.miles || comp.mileage || 0) as number
              const compDays = comp.dos_active ?? comp.dom_180 ?? comp.dom
              return (
                <View key={idx} style={styles.tableRow} wrap={false}>
                  <View style={styles.colVehicle}>
                    <Text style={styles.vehicleNameText}>
                      {comp.year} {comp.make} {comp.model}
                    </Text>
                    {comp.trim && <Text style={styles.vehicleTrimText}>{comp.trim}</Text>}
                  </View>
                  <View style={styles.colMileage}>
                    <Text style={styles.tableBodyText}>
                      {compMiles > 0 ? `${formatMileage(compMiles)} mi` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.colPrice}>
                    <Text style={styles.priceGreenText}>
                      {formatCurrency(comp.price as number)}
                    </Text>
                  </View>
                  <View style={styles.colDays}>
                    <Text style={styles.tableBodyText}>
                      {compDays !== undefined ? `${compDays} days` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.colDealer}>
                    {comp.vdp_url && comp.dealer_name ? (
                      <Link src={comp.vdp_url as string} style={styles.dealerLinkStyle}>
                        {comp.dealer_name as string}
                      </Link>
                    ) : (
                      <Text style={styles.dealerPlainStyle}>
                        {(comp.dealer_name || 'N/A') as string}
                      </Text>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* ── ADDITIONAL VALUATION CONSIDERATIONS ─────────── */}
        <View style={styles.sectionBoxAlt}>
          <Text style={styles.considTitle}>ADDITIONAL VALUATION CONSIDERATIONS</Text>
          <Text style={styles.considIntro}>
            Note: The following undocumented factors can significantly impact your vehicle&apos;s
            actual cash value. Documenting these conditions with photos and records strengthens your
            position when contesting an insurance settlement offer.
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Physical Condition: </Text>
            Overall vehicle condition (Excellent to Poor) based on exterior paint quality, body
            damage, rust, interior upholstery wear, and mechanical condition of engine,
            transmission, and brakes.{' '}
            <Text style={styles.boldInline}>Impact: -20% (poor) to +12% (excellent)</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Accident &amp; Title History: </Text>
            Clean title vs. salvage/rebuilt, documented accident history, and number of previous
            owners. One-owner vehicles with clean titles command premiums.{' '}
            <Text style={styles.boldInline}>Impact: -50% (salvage) to +8% (1-owner clean)</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Service Records: </Text>
            Well-documented maintenance history with receipts from authorized dealers or reputable
            shops demonstrates proper care and increases buyer confidence.{' '}
            <Text style={styles.boldInline}>Impact: +5% to +10%</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Factory Options &amp; Equipment: </Text>
            Premium features including navigation systems, sunroof, heated/ventilated seats,
            advanced safety packages, leather interior, and technology upgrades add measurable
            value. <Text style={styles.boldInline}>Impact: +3% to +15%</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Vehicle Usage &amp; Environment: </Text>
            Non-smoker vehicles, garage-kept storage, personal use (vs. fleet/rental/rideshare), and
            climate history (rust-belt vs. sun-belt) affect long-term condition and desirability.{' '}
            <Text style={styles.boldInline}>Impact: -15% (smoking) to +8% (garage-kept)</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Documentation Quality: </Text>
            Presence of both key fobs, owner&apos;s manual, service records, original equipment
            (spare tire, jack, tools), and proof of recall completion demonstrates thorough
            ownership. <Text style={styles.boldInline}>Impact: +2% to +5%</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Regional Factors: </Text>
            4WD/AWD commands premium in snow states, convertibles more valuable in warm climates,
            diesel trucks in rural areas, and fuel efficiency during high gas prices.{' '}
            <Text style={styles.boldInline}>Impact: +5% to +15% (region-dependent)</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Recent Maintenance: </Text>
            New tires, recent brake service, fresh oil change, new battery, or completed major
            services (timing belt, transmission service) add immediate value.{' '}
            <Text style={styles.boldInline}>Impact: +$500 to $2,000</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Special Circumstances: </Text>
            Limited edition models, performance variants, anniversary editions, remaining factory
            warranty, prepaid maintenance plans, and unrepaired recall status all affect market
            value. <Text style={styles.boldInline}>Impact: varies significantly</Text>
          </Text>

          <Text style={styles.considPara}>
            <Text style={styles.boldInline}>Aftermarket Modifications: </Text>
            Quality additions like remote start or premium audio can add value, while excessive
            modifications, lowering kits, or poor-quality work typically decrease value.{' '}
            <Text style={styles.boldInline}>Impact: -10% to +5%</Text>
          </Text>

          <Text style={styles.considRecommend}>
            Recommendation: Photograph and document all positive factors listed above. For
            professional assistance with appraisals, inspections, or claims support, visit our
            Professional Services Directory at totallosstoolkit.com/services.
          </Text>
        </View>

        {/* ── MONEY-BACK GUARANTEE ─────────────────────────── */}
        <View style={styles.guaranteeBox}>
          <Text style={styles.guaranteeTitle}>100% Money-Back Guarantee</Text>
          <Text style={styles.guaranteeText}>
            If the insurance settlement falls short of our valuation, request a full refund within
            90 days. We&apos;re confident in our valuations and stand behind every report we
            generate.
          </Text>
        </View>

        {/* ── DISCLAIMER ───────────────────────────────────── */}
        <View>
          <Text style={styles.disclaimerText}>
            This valuation report is intended for informational purposes only and does not
            constitute a professional appraisal, legal advice, or binding offer. Valuations use
            proprietary algorithms aggregating data from VinAudit, Auto.dev, CarsXE, and
            MarketCheck. Vehicle market values are subject to rapid change based on local demand,
            condition variances, and economic fluctuations. Consult with a certified appraiser or
            insurance adjuster for final settlement figures.
          </Text>
          <View style={styles.disclaimerFooterRow}>
            <Text style={styles.disclaimerFooterText}>
              © {new Date().getFullYear()} ELITE VALUATION SERVICES
            </Text>
            <Text style={styles.disclaimerFooterText}>
              TERMS OF SERVICE | PRIVACY POLICY | CONTACT SUPPORT
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
