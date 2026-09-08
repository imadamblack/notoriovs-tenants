import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain, tenantHasDashboard } from '@/utils/getTenant'
import { verifyDashboardToken, DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'
import DashboardLogin from '@/components/dashboard/DashboardLogin'
import DashboardApp from '@/components/dashboard/DashboardApp'
import DashboardUnavailable from '@/components/dashboard/DashboardUnavailable'

type DashboardPageProps = {
  params: Promise<{ subdomain: string }>
}

export const metadata = { title: 'Dashboard de leads' }

export default async function TenantDashboardPage({ params }: DashboardPageProps) {
  const { subdomain } = await params
  const [tenant, hasDashboard] = await Promise.all([
    getTenantBySubdomain(subdomain, 'dashboard'),
    tenantHasDashboard(subdomain),
  ])

  if (!tenant) notFound()

  // La contraseña en sí no se carga aquí: esta página se renderiza sin
  // sesión (es la que muestra el login), así que solo pregunta si hay
  // dashboard configurado. Ver `tenantHasDashboard`.
  if (!hasDashboard) {
    return <DashboardUnavailable />
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(DASHBOARD_COOKIE_NAME)?.value
  const authed = verifyDashboardToken(token, subdomain)

  if (!authed) {
    return (
      <DashboardLogin subdomain={subdomain} companyName={tenant.generalInfo?.companyName || tenant.name} />
    )
  }

  return (
    <DashboardApp
      subdomain={subdomain}
      companyName={tenant.generalInfo?.companyName || tenant.name}
      // Filtra por si acaso una fila del array llegara sin id (Payload lo
      // tipa como opcional); en la práctica siempre lo tiene una vez que el
      // tenant se guardó, así que esto nunca debería quitar etapas reales.
      pipeline={(tenant.leadPipeline || []).filter((stage): stage is typeof stage & { id: string } => Boolean(stage.id))}
      stuckAfterDays={tenant.leadStuckAfterDays}
    />
  )
}
