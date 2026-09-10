import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain, tenantHasDashboard } from '@/utils/getTenant'
import { resolveDashboardAuth, sessionPermissions } from '@/utils/requireDashboardAuth'
import DashboardLogin from '@/components/dashboard/DashboardLogin'
import DashboardApp from '@/components/dashboard/DashboardApp'
import DashboardUnavailable from '@/components/dashboard/DashboardUnavailable'

type DashboardPageProps = {
  params: Promise<{ subdomain: string }>
}

export const metadata = { title: 'Dashboard de leads' }

// El dashboard NO se cachea. Leer la sesión ya lo volvería dinámico por sí
// solo, pero eso es una consecuencia de cómo está escrito hoy, no una
// decisión: si mañana alguien mueve esa lectura a otro lado, una página con
// leads de un cliente no puede terminar servida desde el CDN por accidente.
export const dynamic = 'force-dynamic'

export default async function TenantDashboardPage({ params }: DashboardPageProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain, 'dashboard')

  if (!tenant) notFound()

  // Ningún dato del Tenant User se carga aquí: esta página se renderiza sin
  // sesión (es la que muestra el login), así que solo pregunta si el tenant
  // tiene a alguien que pueda entrar. Ver `tenantHasDashboard`.
  const [hasDashboard, requestHeaders] = await Promise.all([
    tenantHasDashboard(tenant.id),
    headers(),
  ])

  if (!hasDashboard) {
    return <DashboardUnavailable />
  }

  const companyName = tenant.generalInfo?.companyName || tenant.name
  const auth = await resolveDashboardAuth(requestHeaders)

  if (!auth) {
    return <DashboardLogin subdomain={subdomain} companyName={companyName} />
  }

  return (
    <DashboardApp
      companyName={companyName}
      // Con quién está firmada la sesión, para el menú de cuenta.
      accountEmail={auth.session.email}
      // Qué puede hacer este rol, ya resuelto en el servidor. La interfaz lo
      // usa para no ofrecer botones que la API va a rechazar; quien decide de
      // verdad es cada ruta, que vuelve a preguntar por su cuenta.
      permissions={sessionPermissions(auth.session)}
      // Filtra por si acaso una fila del array llegara sin id (Payload lo
      // tipa como opcional); en la práctica siempre lo tiene una vez que el
      // tenant se guardó, así que esto nunca debería quitar etapas reales.
      pipeline={(tenant.leadPipeline || []).filter((stage): stage is typeof stage & { id: string } => Boolean(stage.id))}
      stuckAfterDays={tenant.leadStuckAfterDays}
    />
  )
}
