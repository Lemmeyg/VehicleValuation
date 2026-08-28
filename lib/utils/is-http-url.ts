/**
 * True only when `value` is a string beginning with an http:// or https://
 * scheme. Used to guard untrusted MarketCheck `vdp_url` values before they are
 * rendered as links on the print page and in the PDF template — anything else
 * (javascript:, data:, relative, missing) renders as plain text instead.
 */
export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}
