import '@/styles/dashboard/dashboard.scss'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { faviconMarkup } from '@/components/Favicon'

const dashboardFaviconSvg = faviconMarkup.replace('currentColor', '#10312c')
const dashboardFaviconHref = `data:image/svg+xml,${encodeURIComponent(dashboardFaviconSvg)}`

export const metadata: Metadata = {
  icons: {
    icon: dashboardFaviconHref,
    apple: '/apple-touch-icon-dashboard.png',
  },
  // Solo el Dashboard es instalable (issue 36): el sitio público del tenant
  // no lleva este link, así que no aparece "agregar a inicio" para el quiz.
  manifest: '/manifest.webmanifest',
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="dashboard-root">{children}</div>
}
