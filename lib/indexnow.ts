/**
 * IndexNow — tells Bing/Yandex/etc. a page changed instead of waiting for
 * their crawler to notice on its own. Google does not participate in
 * IndexNow; this has no effect on Google indexing.
 *
 * Setup: the key below must match the key file published at
 * public/<key>.txt (see KEY_LOCATION). Docs: https://www.indexnow.org/
 */

const INDEXNOW_KEY = '7ac91d6bd90348e16e7b6071cdb10e70'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const SITE_HOST = 'www.totallosstoolkit.com'
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`

/**
 * Submits one or more absolute URLs to IndexNow. Never throws — a failed
 * submission must never break the publish flow it's attached to.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const urlList = urls.filter(Boolean)
  if (urlList.length === 0) return

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList,
      }),
    })

    if (!response.ok) {
      console.error('[INDEXNOW_ERROR]', {
        status: response.status,
        statusText: response.statusText,
        urlCount: urlList.length,
      })
      return
    }

    console.log('[INDEXNOW_SUBMITTED]', { urlCount: urlList.length })
  } catch (error) {
    console.error('[INDEXNOW_ERROR]', error)
  }
}
