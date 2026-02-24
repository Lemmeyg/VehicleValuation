import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TotalLossToolKit.com - Independent Market Valuations'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        padding: '60px',
      }}
    >
      {/* Logo and brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '40px',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#10b981',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '40px',
            fontWeight: 'bold',
          }}
        >
          TL
        </div>
        <span
          style={{
            color: '#10b981',
            fontSize: '48px',
            fontWeight: 'bold',
          }}
        >
          TotalLossToolKit
        </span>
      </div>

      {/* Main headline */}
      <h1
        style={{
          color: 'white',
          fontSize: '56px',
          fontWeight: 'bold',
          textAlign: 'center',
          margin: 0,
          marginBottom: '24px',
          lineHeight: 1.2,
        }}
      >
        Independent Market Valuations
      </h1>

      {/* Subheadline */}
      <p
        style={{
          color: '#94a3b8',
          fontSize: '28px',
          textAlign: 'center',
          margin: 0,
          maxWidth: '800px',
        }}
      >
        Professional reports for total loss claims, diminished value, and insurance negotiations
      </p>

      {/* Bottom URL */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            color: '#64748b',
            fontSize: '22px',
          }}
        >
          www.totallosstoolkit.com
        </span>
      </div>
    </div>,
    {
      ...size,
    }
  )
}
