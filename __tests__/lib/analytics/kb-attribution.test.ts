import { setKBAttribution, getKBAttribution } from '@/lib/analytics/kb-attribution'

describe('kb-attribution', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('setKBAttribution', () => {
    it('writes slug, title, and visited_at to sessionStorage', () => {
      setKBAttribution('challenge-comps', 'How to Challenge Comparable Vehicles')

      const raw = sessionStorage.getItem('kb_last_touch')
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

    it('returns null if sessionStorage contains invalid JSON', () => {
      sessionStorage.setItem('kb_last_touch', 'not-json')
      expect(getKBAttribution()).toBeNull()
    })

    it('ignores stale attribution left in localStorage from a previous browser session', () => {
      // Regression test: kb-attribution used to persist in localStorage indefinitely, so a
      // KB article visited in an earlier, unrelated session would incorrectly attribute a
      // much later, disconnected submission (e.g. a homepage form) to that old article.
      localStorage.setItem(
        'kb_last_touch',
        JSON.stringify({
          slug: 'maryland-total-loss-law-explained',
          title: 'Maryland Total Loss Law Explained',
          visited_at: '2020-01-01T00:00:00.000Z',
        })
      )

      expect(getKBAttribution()).toBeNull()
    })
  })
})
