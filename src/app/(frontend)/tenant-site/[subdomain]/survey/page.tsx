import { notFound } from 'next/navigation'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { mapTenantQuizToSurveySteps } from '@/utils/tenantQuiz'
import SurveyForm from './survey-form'

type TenantSurveyPageProps = {
  params: Promise<{ subdomain: string }>
}

/**
 * Equivalente multi-tenant de /src/app/(frontend)/survey/page.tsx: mismo
 * componente (StepRenderer/formAtoms) y misma UX (barra de progreso,
 * animaciones, tracking), pero los `steps` salen del documento tenant en
 * lugar de estar hardcodeados. Se resuelve el tenant server-side aquí y se
 * delega el formulario (client component) a ./survey-form.
 */
export default async function TenantSurveyPage({ params }: TenantSurveyPageProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) notFound()

  const steps = mapTenantQuizToSurveySteps(tenant.quizSteps)

  if (!steps.length) {
    return (
      <main className="container py-20">
        <p>Este tenant todavía no tiene un quiz configurado.</p>
      </main>
    )
  }

  return (
    <SurveyForm
      subdomain={subdomain}
      steps={steps}
      intro={tenant.quizIntro || undefined}
      privacyNoticeUrl={tenant.generalInfo?.privacyNoticeUrl || '/privacy-notice'}
      logo={tenant.generalInfo?.logo}
      tenantName={tenant.generalInfo?.companyName || tenant.name}
    />
  )
}
