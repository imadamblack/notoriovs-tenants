import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain } from '@/utils/getTenant'
import TrackingAnalytics from '@/components/trackingAnalytics'

type TenantLayoutProps = {
  children: ReactNode
  params: Promise<{ subdomain: string }>
}

// Layout compartido por landing y quiz del tenant: valida que el subdominio
// exista y esté activo antes de renderizar cualquier ruta hija, y monta el
// tracking (Meta Pixel / Google Tag) propio del tenant en vez del pixel
// global del sitio default. Si el tenant no configuró tracking.metaPixelId,
// TrackingAnalytics cae en el pixel global (process.env.PIXEL); pásalo como
// null explícito si en algún momento quieres que un tenant no dispare nada.
export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) notFound()

  return (
    <>
      <TrackingAnalytics pixelId={tenant.tracking?.metaPixelId} googleTagId={tenant.tracking?.googleTagId} />
      {children}
    </>
  )
}
