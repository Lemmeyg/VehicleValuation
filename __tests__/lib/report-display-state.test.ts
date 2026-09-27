import { computeReportDisplayState } from '@/lib/report-display-state'

describe('computeReportDisplayState', () => {
  it('returns refunded when status is refunded, regardless of other fields', () => {
    expect(computeReportDisplayState({ status: 'refunded', pdfDownloadToken: 'tok-1' })).toBe(
      'refunded'
    )
  })

  it.each(['needs_review', 'vin_decode_failed', 'valuation_failed', 'failed'])(
    'returns held for status %s',
    status => {
      expect(computeReportDisplayState({ status, pdfDownloadToken: null })).toBe('held')
    }
  )

  it('returns ready when status is completed and a pdfDownloadToken exists', () => {
    expect(computeReportDisplayState({ status: 'completed', pdfDownloadToken: 'tok-1' })).toBe(
      'ready'
    )
  })

  it('returns progress when status is completed but there is no pdfDownloadToken yet', () => {
    expect(computeReportDisplayState({ status: 'completed', pdfDownloadToken: null })).toBe(
      'progress'
    )
  })

  it('returns progress for pending', () => {
    expect(computeReportDisplayState({ status: 'pending', pdfDownloadToken: null })).toBe(
      'progress'
    )
  })

  it('refunded takes priority over held (a held report can still be refunded)', () => {
    expect(computeReportDisplayState({ status: 'refunded', pdfDownloadToken: null })).toBe(
      'refunded'
    )
  })

  it('returns ready when status is completed and pdf_storage_path exists even without a pdf_download_token (legacy reports from before that column existed)', () => {
    expect(
      computeReportDisplayState({
        status: 'completed',
        pdfDownloadToken: null,
        pdfStoragePath: 'reports/user-1/report.pdf',
      })
    ).toBe('ready')
  })

  it('still returns progress when status is completed and neither pdfDownloadToken nor pdfStoragePath exist', () => {
    expect(
      computeReportDisplayState({
        status: 'completed',
        pdfDownloadToken: null,
        pdfStoragePath: null,
      })
    ).toBe('progress')
  })
})
