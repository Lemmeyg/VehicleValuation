import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Article Image'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Use raw fetch instead of Supabase JS client — keeps edge bundle under 1 MB
  let title = 'Knowledge Base Article'
  let category = 'Guide'
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles?slug=eq.${slug}&published=eq.true&select=title,category&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (data[0]) {
        title = data[0].title || title
        category = data[0].category || category
      }
    }
  } catch {
    // Fall back to defaults
  }

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a',
        padding: '60px',
      }}
    >
      {/* Top section with logo and category */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#10b981',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            TL
          </div>
          <span
            style={{
              color: '#10b981',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            TotalLossToolKit
          </span>
        </div>
        <div
          style={{
            backgroundColor: '#1e293b',
            color: '#10b981',
            padding: '8px 20px',
            borderRadius: '20px',
            fontSize: '18px',
            fontWeight: '600',
          }}
        >
          {category}
        </div>
      </div>

      {/* Title section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          maxWidth: '90%',
        }}
      >
        <h1
          style={{
            color: 'white',
            fontSize: title.length > 60 ? '42px' : '52px',
            fontWeight: 'bold',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>

      {/* Bottom section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <span
          style={{
            color: '#94a3b8',
            fontSize: '20px',
          }}
        >
          Independent Vehicle Valuations & Insurance Claim Support
        </span>
        <span
          style={{
            color: '#64748b',
            fontSize: '18px',
          }}
        >
          totallosstoolkit.com
        </span>
      </div>
    </div>,
    {
      ...size,
    }
  )
}
