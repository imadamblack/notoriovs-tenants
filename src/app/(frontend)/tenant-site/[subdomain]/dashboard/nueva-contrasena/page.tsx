import { notFound } from 'next/navigation'
import { getTenantBySubdomain } from '@/utils/getTenant'
import SetPasswordScreen from '@/components/dashboard/SetPasswordScreen'

type SetPasswordPageProps = {
  params: Promise<{ subdomain: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata = { title: 'Elegir contraseña' }

// Donde aterrizan los dos correos de este flujo: el de recuperación y el de
// invitación. Son el mismo token y la misma pantalla.
//
// La página no valida el token ni dice de quién es: eso solo pasa al enviar,
// en el servidor. Renderizar un "token válido / inválido" antes de tiempo
// sería un oráculo para adivinar tokens, y además ya no haría falta —quien
// llega aquí con un enlace bueno solo quiere escribir su contraseña.
export const dynamic = 'force-dynamic'

export default async function TenantSetPasswordPage({ params, searchParams }: SetPasswordPageProps) {
  const [{ subdomain }, { token }] = await Promise.all([params, searchParams])
  const tenant = await getTenantBySubdomain(subdomain, 'tenantMail')

  if (!tenant) notFound()

  return (
    <SetPasswordScreen
      subdomain={subdomain}
      companyName={tenant.generalInfo?.companyName || tenant.name}
      token={typeof token === 'string' ? token : ''}
    />
  )
}
