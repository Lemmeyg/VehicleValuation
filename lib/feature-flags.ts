export function isEmailCaptureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_FORM_EMAIL_CAPTURE === 'true'
}
