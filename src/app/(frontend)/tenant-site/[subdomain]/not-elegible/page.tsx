import {notFound} from 'next/navigation'
import {getTenantBySubdomain} from '@/utils/getTenant'
import Image from "next/image";

type TenantNotEligiblePageProps = {
  params: Promise<{ subdomain: string }>
}

// Página a la que se redirige al lead cuando, en una pregunta tipo radio del
// quiz, elige una opción marcada como "Descalifica al lead" (ver campo
// `options.disqualifies` en Tenants.ts y la lógica de redirección en
// survey-form.tsx). El tab "Página No Elegible" del tenant permite
// personalizar título, subtítulo y contenido (WYSIWYG). Si el tenant no
// configuró estos campos, cae al copy genérico.
export default async function TenantNotEligiblePage({params}: TenantNotEligiblePageProps) {
  const {subdomain} = await params
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) notFound()

  const notEligiblePage = tenant.notEligiblePage
  const tenantName = tenant.name
  const logo = tenant.generalInfo?.logo

  const title = notEligiblePage?.title || 'Gracias por tu interés'
  const subtitle =
    notEligiblePage?.subtitle ||
    `Por el momento no cumples con los criterios para continuar con ${tenant.generalInfo?.companyName || tenant.name}.`

  return (
    <main className="py-12 flex-grow">
      <div className="reading-container bg-neutral-100 flex flex-col">
        {logo != null && typeof logo === 'object' ? (
          <div className="relative flex justify-start w-40 h-16">
            <Image
              src={(logo as {url?: string}).url || ''}
              alt=""
              fill
              style={{objectFit: 'contain'}}
            />
          </div>
        ) : (
          tenantName && (
            <p className="ft-3 font-bold text-white z-10">{tenantName}</p>
          )
        )}
        <h1 className="ft-6 font-bold">{title}</h1>
        <p className="ft-2">{subtitle}</p>
        {notEligiblePage?.contentHTML && (
          <div
            className="ft-1 flex-grow"
            dangerouslySetInnerHTML={{__html: notEligiblePage.contentHTML}}
          />
        )}
        <div className="-ft-2 mt-12">© {new Date().getFullYear()} {tenantName}. Todos los derechos reservados.</div>
      </div>
    </main>
  )
}
