import { setDripAttribution, getDripAttribution } from '@/lib/analytics/drip-attribution'

describe('drip-attribution', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('setDripAttribution', () => {
    it('writes utm_source, utm_medium, utm_content, and captured_at to localStorage', () => {
      setDripAttribution('zoho', 'email', 'step_2')

      const raw = localStorage.getItem('drip_last_touch')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.utm_source).toBe('zoho')
      expect(parsed.utm_medium).toBe('email')
      expect(parsed.utm_content).toBe('step_2')
      expect(typeof parsed.captured_at).toBe('string')
    })

    it('overwrites previous entry — last touch wins', () => {
      setDripAttribution('zoho', 'email', 'step_1')
      setDripAttribution('zoho', 'email', 'step_3')

      const result = getDripAttribution()
      expect(result?.utm_content).toBe('step_3')
    })
  })

  describe('getDripAttribution', () => {
    it('returns null when nothing is stored', () => {
      expect(getDripAttribution()).toBeNull()
    })

    it('returns the stored attribution object', () => {
      setDripAttribution('zoho', 'email', 'step_1')

      const result = getDripAttribution()
      expect(result?.utm_source).toBe('zoho')
      expect(result?.utm_medium).toBe('email')
      expect(result?.utm_content).toBe('step_1')
      expect(result?.captured_at).toBeDefined()
    })

    it('returns null if localStorage contains invalid JSON', () => {
      localStorage.setItem('drip_last_touch', 'not-json')
      expect(getDripAttribution()).toBeNull()
    })
  })
})
