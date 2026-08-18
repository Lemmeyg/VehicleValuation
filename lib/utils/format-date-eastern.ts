/**
 * Formats dates and times in US Eastern local time (America/New_York), so displayed
 * timestamps read correctly regardless of which time zone the server happens to run
 * in. Automatically shifts between EST and EDT with daylight saving — never hardcode
 * a fixed UTC offset instead of using these.
 *
 * Display only: values are still stored in UTC. Use these wherever a date or time is
 * shown to a person; never for internal comparisons or calculations.
 */

const EASTERN_TIME_ZONE = 'America/New_York'

export function formatDateTimeET(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(date).toLocaleString('en-US', { timeZone: EASTERN_TIME_ZONE, ...options })
}

export function formatDateET(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(date).toLocaleDateString('en-US', { timeZone: EASTERN_TIME_ZONE, ...options })
}

export function formatTimeET(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(date).toLocaleTimeString('en-US', { timeZone: EASTERN_TIME_ZONE, ...options })
}
