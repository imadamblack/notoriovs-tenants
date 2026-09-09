import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain, tenantHasDashboard } from '@/utils/getTenant'
import { DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'
import { resolveDashboardAuth } from '@/utils/requireDashboardAuth'
import DashboardLogin from '@/components/dashboard/DashboardLogin'
import DashboardApp from '@/components/dashboard/DashboardApp'
import DashboardUnavailable from '@/components/dashboard/DashboardUnavailable'

type DashboardPageProps = {
  params: Promise<{ subdomain: string }>
}

export const metadata = { title: 'Dashboard de leads' }

// El dashboard NO se cachea. `cookies()` ya lo volvería dinámico por sí solo,
// pero eso es una consecuencia de cómo está escrito hoy, no una decisión: si
// mañana alguien mueve la lectura de la sesión a otro lado, una página con
// leads de un cliente no puede terminar servida desde el CDN por accidente.
export const dynamic = 'force-dynamic'

export default async function TenantDashboardPage({ params }: DashboardPageProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain, 'dashboard')

  if (!tenant) notFound()

  // Ni la contraseña compartida ni ningún dato del Tenant User se cargan aquí:
  // esta página se renderiza sin sesión (es la que muestra el login), así que
  // solo pregunta si queda alguna puerta abierta. Ver `tenantHasDashboard`.
  const [hasDashboard, requestHeaders, cookieStore] = await Promise.all([
    tenantHasDashboard(subdomain, tenant.id),
    headers(),
    cookies(),
  ])

  if (!hasDashboard) {
    return <DashboardUnavailable />
  }

  const companyName = tenant.generalInfo?.companyName || tenant.name
  const auth = await resolveDashboardAuth(
    requestHeaders,
    cookieStore.get(DASHBOARD_COOKIE_NAME)?.value,
    subdomain,
  )

  if (!auth) {
    return <DashboardLogin subdomain={subdomain} companyName={companyName} />
  }

  return (
    <DashboardApp
      subdomain={subdomain}
      companyName={companyName}
      // Con quién está firmada la sesión. En una de Tenant User es su email;
      // con la contraseña compartida no hay nadie a quién nombrar, y el menú
      // de cuenta lo dice tal cual en vez de inventarse un usuario.
      accountEmail={auth.session.kind === 'tenant-user' ? auth.session.email : null}
      // Filtra por si acaso una fila del array llegara sin id (Payload lo
      // tipa como opcional); en la práctica siempre lo tiene una vez que el
      // tenant se guardó, así que esto nunca debería quitar etapas reales.
      pipeline={(tenant.leadPipeline || []).filter((stage): stage is typeof stage & { id: string } => Boolean(stage.id))}
      stuckAfterDays={tenant.leadStuckAfterDays}
    />
  )
}
