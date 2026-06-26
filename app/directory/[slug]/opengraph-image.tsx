import { ImageResponse } from 'next/og'
import { getSupplierBySlugStatic, getAllSupplierSlugs } from '@/lib/suppliers-db'

export const alt = 'Provider Profile'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export async function generateStaticParams() {
  const slugs = await getAllSupplierSlugs()
  return slugs.map(slug => ({ slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supplier = await getSupplierBySlugStatic(slug)

  const businessName = supplier?.businessName || 'Service Provider'
  const location = supplier ? `${supplier.city}, ${supplier.state}` : 'Location'
  const serviceType = supplier?.serviceType || 'provider'

  const serviceLabels: Record<string, string> = {
    appraiser: 'Vehicle Appraiser',
    body_shop: 'Body Shop',
    advocate: 'Claims Advocate',
    attorney: 'Auto Attorney',
  }
  const serviceLabel = serviceLabels[serviceType] || 'Service Provider'

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
      {/* Top section with logo and badge */}
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
          {serviceLabel}
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          maxWidth: '90%',
        }}
      >
        <div
          style={{
            color: '#64748b',
            fontSize: '22px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Provider Directory</span>
        </div>
        <h1
          style={{
            color: 'white',
            fontSize: businessName.length > 40 ? '42px' : '52px',
            fontWeight: 'bold',
            lineHeight: 1.2,
            margin: 0,
            marginBottom: '16px',
          }}
        >
          {businessName}
        </h1>
        <div
          style={{
            color: '#94a3b8',
            fontSize: '26px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{location}</span>
        </div>
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
          Find trusted providers for your vehicle claim needs
        </span>
        <span
          style={{
            color: '#64748b',
            fontSize: '18px',
          }}
        >
          totallosstoolkit.com/directory
        </span>
      </div>
    </div>,
    {
      ...size,
    }
  )
}
