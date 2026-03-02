import { getAllDispatches } from '@/lib/dispatches'

const SITE_URL = 'https://www.ubtrippin.xyz'
const DISPATCHES_URL = `${SITE_URL}/dispatches`

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const dispatches = getAllDispatches()

  const items = dispatches
    .map((dispatch) => {
      const link = `${DISPATCHES_URL}/${dispatch.slug}`
      const pubDate = new Date(`${dispatch.date}T00:00:00Z`).toUTCString()

      return `
    <item>
      <title>${escapeXml(dispatch.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(dispatch.summary)}</description>
    </item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>UBTRIPPIN: THE STORY</title>
    <link>${DISPATCHES_URL}</link>
    <description>Weekly dispatches from inside the build</description>
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
