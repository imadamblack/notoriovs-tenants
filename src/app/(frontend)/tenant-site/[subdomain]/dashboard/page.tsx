import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTenantBySubdomain, tenantHasDashboard } from '@/utils/getTenant'
import { resolveDashboardAuth, sessionPermissions } from '@/utils/requireDashboardAuth'
import DashboardLogin from '@/components/dashboard/DashboardLogin'
import DashboardApp from '@/components/dashboard/DashboardApp'
import DashboardUnavailable from '@/components/dashboard/DashboardUnavailable'
import { quizQuestions } from '@/utils/leadAnswers'
import { headerFromQuizStep } from '@/utils/leadsCsv'
import type { TenantQuizStep } from '@/utils/tenantQuiz'
import type { QuizQuestion } from '@/components/dashboard/DashboardApp'

/**
 * Las preguntas del quiz recortadas a lo que usa el panel de detalle: cómo se
 * llama el campo, cómo se le preguntó al lead y qué podía contestar. El resto
 * del paso (textos de error, columnas del grid, HTML de los checkpoints) no
 * tiene nada que hacer cruzando al navegador.
 *
 * El título pasa por el mismo limpiador que los encabezados del CSV:
 * `quizSteps.title` admite HTML y aquí se pinta como texto.
 */
function dashboardQuestions(steps: TenantQuizStep[] | null | undefined): QuizQuestion[] {
  return quizQuestions(steps).map((step) => ({
    name: step.name,
    label: headerFromQuizStep(step),
    type: step.type,
    options: (step.options || []).map((option) => ({ label: option.label, value: option.value })),
  }))
}

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
      // Las preguntas del quiz, para que el panel de detalle pueda mostrar
      // cada respuesta con su pregunta y ofrecer las mismas opciones que vio
      // el lead al corregirla.
      questions={dashboardQuestions(tenant.quizSteps)}
    />
  )
}
