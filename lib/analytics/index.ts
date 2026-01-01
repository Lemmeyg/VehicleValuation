/**
 * Analytics Module
 *
 * Centralized analytics tracking using PostHog
 *
 * @example
 * ```tsx
 * // In a React component
 * import { useAnalytics } from '@/lib/analytics'
 *
 * function MyComponent() {
 *   const analytics = useAnalytics()
 *
 *   const handleSubmit = () => {
 *     analytics.trackVehicleSearch({
 *       searchMethod: 'vin',
 *       vin: '1HGBH41JXMN109186'
 *     })
 *   }
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Outside React components (e.g., in API routes or utilities)
 * import { trackReportGeneration } from '@/lib/analytics'
 *
 * trackReportGeneration({
 *   reportType: 'total-loss',
 *   isPaid: true,
 *   estimatedValue: 25000
 * })
 * ```
 */

// Export all event tracking functions
export * from './events'

// Export the custom hook
export { useAnalytics } from './use-analytics'

// Export type definitions for convenience
export type {
  VehicleSearchEvent,
  ReportGenerationEvent,
  PaymentEvent,
  UserIdentificationEvent,
} from './events'
