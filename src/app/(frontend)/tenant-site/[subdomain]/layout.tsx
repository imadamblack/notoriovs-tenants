import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain } from '@/utils/getTenant'
import TrackingAnalytics from '@/components/trackingAnalytics'

type TenantLayoutProps = {
  children: ReactNode
  params: Promise<{ subdomain: string }>
}

/**
 * Vacío a propósito: no se prerrenderiza ningún tenant en el build.
 *
 * Lo que hace este export es declarar el segmento como estático con
 * generación bajo demanda: la página de un subdominio se arma en la primera
 * visita y se queda cacheada hasta que alguien la invalide. Alternativa
 * descartada: listar los tenants aquí obligaría a tener la base disponible
 * durante el build y volvería a hacer falta un deploy para publicar un
 * tenant nuevo — justo lo que este diseño evita.
 */
export function generateStaticParams(): { subdomain: string }[] {
  return []
}

const DEFAULT_TITLE = 'Another Real Estate Agency'
const DEFAULT_DESCRIPTION = 'Agencia boutique de inversión inmobiliaria en preventa'

type ResolvedMedia = { url?: string | null; alt?: string | null } | null | undefined

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain, 'chrome')

  if (!tenant) {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
    }
  }

  const title = tenant.generalInfo?.companyName || tenant.name || DEFAULT_TITLE
  const description =
    tenant.landingHero?.subtitle || tenant.quizIntro?.description || DEFAULT_DESCRIPTION
  const logo = tenant.generalInfo?.logo as ResolvedMedia

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: logo?.url ? [{ url: logo.url, alt: logo.alt || title }] : undefined,
    },
  }
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain, 'chrome')

  if (!tenant) notFound()

  return (
    <>
      <TrackingAnalytics pixelId={tenant.tracking?.metaPixelId} googleTagId={tenant.tracking?.googleTagId} />
      {children}
    </>
  )
}
