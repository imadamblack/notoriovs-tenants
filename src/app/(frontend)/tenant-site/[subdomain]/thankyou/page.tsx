import {notFound} from 'next/navigation'
import {getTenantBySubdomain} from '@/utils/getTenant'
import Image from "next/image";

type TenantThankYouPageProps = {
  params: Promise<{ subdomain: string }>
}

// Página de gracias post-envío del quiz. El tab "Thank You Page" del tenant
// permite personalizar título, subtítulo y contenido (WYSIWYG). Si el tenant
// no configuró estos campos, cae al copy genérico basado en generalInfo.
export default async function TenantThankYouPage({params}: TenantThankYouPageProps) {
  const {subdomain} = await params
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) notFound()

  const whatsapp = tenant.generalInfo?.whatsapp
  const phone = tenant.generalInfo?.phone
  const thankYouPage = tenant.thankYouPage
  const tenantName = tenant.name
  const logo = tenant.generalInfo?.logo

  const title = thankYouPage?.title || '¡Gracias! Ya recibimos tus respuestas.'
  const subtitle =
    thankYouPage?.subtitle ||
    `Un asesor de ${tenant.generalInfo?.companyName || tenant.name} te va a contactar en breve para platicar los siguientes pasos.`

  return (
    <main className="py-12">
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
        {thankYouPage?.contentHTML && (
          <div
            className="ft-1 mx-auto"
            dangerouslySetInnerHTML={{__html: thankYouPage.contentHTML}}
          />
        )}
        <div className="border-y border-neutral-500 w-full flex flex-col gap-4 py-12">
          <p className="mb-8">No quieres esperar?</p>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              className="button !bg-blue-700 !text-white !w-full"
            >
              Mándanos un WhatsApp
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              target="_blank"
              className="button !border !border-blue-700 !text-blue-700 !bg-transparent !w-full"
            >
              Llámanos
            </a>
          )}
        </div>
        <div className="-ft-2">© {new Date().getFullYear()} {tenantName}. Todos los derechos reservados.</div>
      </div>
    </main>
  )
}
