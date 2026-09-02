import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { verifyDashboardToken, DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'
import DashboardLogin from '@/components/dashboard/DashboardLogin'
import DashboardApp from '@/components/dashboard/DashboardApp'

type DashboardPageProps = {
  params: Promise<{ subdomain: string }>
}

export const metadata = { title: 'Dashboard de leads' }

export default async function TenantDashboardPage({ params }: DashboardPageProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) notFound()

  if (!tenant.dashboardPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-4 px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-sm p-8">
          <h1 className="ft-3 font-bold text-brand-1 mb-2">Dashboard no disponible</h1>
          <p className="text-neutral-600">
            Este tenant todavía no tiene un dashboard configurado. Contacta a Notoriovs para activarlo.
          </p>
        </div>
      </div>
    )
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
    />
  )
}
