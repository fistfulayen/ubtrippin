import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { getCityEventsPageData, getMonthWindow } from '@/lib/events/queries'

export const runtime = 'edge'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const month = getMonthWindow()
  const data = await getCityEventsPageData(supabase, slug, month)
  const topEvent = data?.events[0]

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #312e81 55%, #eef2ff 100%)',
          color: 'white',
          padding: '56px',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: 6, textTransform: 'uppercase', opacity: 0.72 }}>UBTRIPPIN</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 700 }}>{data?.city.city ?? 'City Events'}</div>
          <div style={{ fontSize: 34, maxWidth: 900 }}>{topEvent?.title ?? 'Curated exhibitions, festivals, and performances'}</div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>What&apos;s On Right Now</div>
      </div>
    ),
    size
  )
}
