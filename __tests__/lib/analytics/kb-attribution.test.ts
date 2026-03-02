import { setKBAttribution, getKBAttribution } from '@/lib/analytics/kb-attribution'

describe('kb-attribution', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('setKBAttribution', () => {
    it('writes slug, title, and visited_at to localStorage', () => {
      setKBAttribution('challenge-comps', 'How to Challenge Comparable Vehicles')

      const raw = localStorage.getItem('kb_last_touch')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.slug).toBe('challenge-comps')
      expect(parsed.title).toBe('How to Challenge Comparable Vehicles')
      expect(typeof parsed.visited_at).toBe('string')
    })

    it('overwrites previous entry — last touch wins', () => {
      setKBAttribution('first-article', 'First Article')
      setKBAttribution('second-article', 'Second Article')

      const result = getKBAttribution()
      expect(result?.slug).toBe('second-article')
      expect(result?.title).toBe('Second Article')
    })
  })

  describe('getKBAttribution', () => {
    it('returns null when nothing is stored', () => {
      expect(getKBAttribution()).toBeNull()
    })

    it('returns the stored attribution object', () => {
      setKBAttribution('my-article', 'My Article Title')

      const result = getKBAttribution()
      expect(result?.slug).toBe('my-article')
      expect(result?.title).toBe('My Article Title')
      expect(result?.visited_at).toBeDefined()
    })

    it('returns null if localStorage contains invalid JSON', () => {
      localStorage.setItem('kb_last_touch', 'not-json')
      expect(getKBAttribution()).toBeNull()
    })
  })
})
