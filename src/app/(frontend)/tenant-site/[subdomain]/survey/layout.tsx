import type { ReactNode } from 'react'
import { getTenantBySubdomain } from '@/utils/getTenant'

type TenantSurveyLayoutProps = {
  children: ReactNode
  params: Promise<{ subdomain: string }>
}

// Espejo de /src/app/(frontend)/survey/layout.tsx: layout anidado dentro de
// (frontend)/layout.tsx (que ya define <html>/<body>), solo que el título
// se arma con el nombre real del tenant.
export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain)

  return {
    title: tenant?.generalInfo?.companyName || tenant?.name || 'Quiz',
    description: tenant?.quizIntro?.description || undefined,
  }
}

export default function TenantSurveyLayout({ children }: TenantSurveyLayoutProps) {
  return <main>{children}</main>
}
