/**
 * PDF Report Template
 *
 * React-PDF template for generating vehicle valuation reports
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

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
  accidentBox: {
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fef2f2',
    borderLeft: '3 solid #dc2626',
  },
  accidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  accidentTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  severityBadge: {
    fontSize: 9,
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '3 8',
    borderRadius: 3,
  },
  accidentDetail: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 3,
  },
  noAccidents: {
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderLeft: '3 solid #16a34a',
    fontSize: 10,
    color: '#166534',
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
})

interface VehicleData {
  year?: string
  make?: string
  model?: string
  trim?: string
  bodyType?: string
  engine?: string
  transmission?: string
  driveType?: string
}

interface Accident {
  accidentDate?: string
  location?: string
  severity?: string
  damageDescription?: string
  estimatedCost?: number
}

interface AccidentDetails {
  accidents?: Accident[]
}

interface Valuation {
  lowValue: number
  averageValue: number
  highValue: number
  confidence: string
  dataPoints: number
}

interface ReportData {
  vin: string
  reportType: 'BASIC' | 'PREMIUM'
  createdAt: string
  vehicleData?: VehicleData
  accidentDetails?: AccidentDetails
  valuationResult?: Valuation
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

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
        {data.vehicleData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            {data.vehicleData.year && (
              <View style={styles.row}>
                <Text style={styles.label}>Year:</Text>
                <Text style={styles.value}>{data.vehicleData.year}</Text>
              </View>
            )}
            {data.vehicleData.make && (
              <View style={styles.row}>
                <Text style={styles.label}>Make:</Text>
                <Text style={styles.value}>{data.vehicleData.make}</Text>
              </View>
            )}
            {data.vehicleData.model && (
              <View style={styles.row}>
                <Text style={styles.label}>Model:</Text>
                <Text style={styles.value}>{data.vehicleData.model}</Text>
              </View>
            )}
            {data.vehicleData.trim && (
              <View style={styles.row}>
                <Text style={styles.label}>Trim:</Text>
                <Text style={styles.value}>{data.vehicleData.trim}</Text>
              </View>
            )}
            {data.vehicleData.bodyType && (
              <View style={styles.row}>
                <Text style={styles.label}>Body Type:</Text>
                <Text style={styles.value}>{data.vehicleData.bodyType}</Text>
              </View>
            )}
            {data.vehicleData.engine && (
              <View style={styles.row}>
                <Text style={styles.label}>Engine:</Text>
                <Text style={styles.value}>{data.vehicleData.engine}</Text>
              </View>
            )}
            {data.vehicleData.transmission && (
              <View style={styles.row}>
                <Text style={styles.label}>Transmission:</Text>
                <Text style={styles.value}>{data.vehicleData.transmission}</Text>
              </View>
            )}
            {data.vehicleData.driveType && (
              <View style={styles.row}>
                <Text style={styles.label}>Drive Type:</Text>
                <Text style={styles.value}>{data.vehicleData.driveType}</Text>
              </View>
            )}
          </View>
        )}

        {/* Market Valuation */}
        {data.valuationResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Valuation</Text>
            <View style={styles.valuationContainer}>
              <View style={styles.valuationBox}>
                <Text style={styles.valuationLabel}>Low Value</Text>
                <Text style={styles.valuationValue}>
                  {formatCurrency(data.valuationResult.lowValue)}
                </Text>
              </View>
              <View style={styles.valuationBox}>
                <Text style={styles.valuationLabel}>Average Value</Text>
                <Text style={styles.valuationValueHighlight}>
                  {formatCurrency(data.valuationResult.averageValue)}
                </Text>
              </View>
              <View style={styles.valuationBox}>
                <Text style={styles.valuationLabel}>High Value</Text>
                <Text style={styles.valuationValue}>
                  {formatCurrency(data.valuationResult.highValue)}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Confidence Level:</Text>
              <Text style={styles.value}>{data.valuationResult.confidence}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Data Points Analyzed:</Text>
              <Text style={styles.value}>{data.valuationResult.dataPoints}</Text>
            </View>
          </View>
        )}

        {/* Accident History (Premium Only) */}
        {data.reportType === 'PREMIUM' && data.accidentDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accident History</Text>
            {data.accidentDetails.accidents && data.accidentDetails.accidents.length === 0 ? (
              <View style={styles.noAccidents}>
                <Text>No accidents reported for this vehicle.</Text>
              </View>
            ) : (
              data.accidentDetails.accidents?.map((accident, index) => (
                <View key={index} style={styles.accidentBox}>
                  <View style={styles.accidentHeader}>
                    <Text style={styles.accidentTitle}>Accident {index + 1}</Text>
                    {accident.severity && (
                      <Text style={styles.severityBadge}>{accident.severity}</Text>
                    )}
                  </View>
                  {accident.accidentDate && (
                    <Text style={styles.accidentDetail}>Date: {accident.accidentDate}</Text>
                  )}
                  {accident.location && (
                    <Text style={styles.accidentDetail}>Location: {accident.location}</Text>
                  )}
                  {accident.damageDescription && (
                    <Text style={styles.accidentDetail}>
                      Description: {accident.damageDescription}
                    </Text>
                  )}
                  {accident.estimatedCost && (
                    <Text style={styles.accidentDetail}>
                      Estimated Cost: {formatCurrency(accident.estimatedCost)}
                    </Text>
                  )}
                </View>
              ))
            )}
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
