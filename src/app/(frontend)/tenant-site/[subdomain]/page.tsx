import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTenantBySubdomain } from '@/utils/getTenant'
import { getSubdomainFromHost } from '@/utils/subdomain'

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'notoriovs.com'

type TenantLandingProps = {
  params: Promise<{ subdomain: string }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LandingBlock({ block }: { block: any }) {
  switch (block.blockType) {
    case 'richText':
      return (
        <section className="w-full py-20 border-t border-neutral-300">
          <div className="reading-container">
            {block.heading && <h2 className="font-bold">{block.heading}</h2>}
            <p className="whitespace-pre-line">{block.body}</p>
            {block.ctaLabel && block.ctaLink && (
              <Link href={block.ctaLink} className="button !bg-brand-5 !text-brand-4">
                {block.ctaLabel}
              </Link>
            )}
          </div>
        </section>
      )

    case 'stats':
      return (
        <div className="grid grid-cols-1 bg-neutral-900">
          <div className="container grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-neutral-100 p-0">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(block.items || []).map((item: any, i: number) => (
              <div key={i} className="p-20 bg-neutral-900">
                <div className="ft-8 font-normal text-neutral-100 tracking-[-0.03em] leading-none mb-2.5">
                  {item.number}
                </div>
                <div className="-ft-1 font-light text-neutral-300 leading-snug whitespace-pre-line">
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'criteria':
      return (
        <section className="w-full py-20 border-t border-neutral-300">
          <div className="container">
            <div className="reading-container mb-12">
              {block.heading && <h2 className="font-bold">{block.heading}</h2>}
              {block.intro && <p>{block.intro}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1a1814]/10">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(block.items || []).map((item: any, i: number) => (
                <div key={i} className="bg-[#edeae3] p-9">
                  <p className="ft-1 font-medium">{item.title}</p>
                  <p className="text-neutral-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )

    case 'projects':
      return (
        <section className="w-full py-20 px-8 border-t border-neutral-300">
          <div className="reading-container mb-12">
            {block.heading && <h2 className="font-bold">{block.heading}</h2>}
            {block.intro && <p>{block.intro}</p>}
          </div>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 md:container gap-8">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(block.items || []).map((item: any, i: number) => (
              <div key={i} className="flex flex-col pt-8 pb-16 border-y border-neutral-300">
                <div className="-ft-3 uppercase text-neutral-600">{item.zone}</div>
                <h3 className="ft-6 !my-0 font-semibold">{item.name}</h3>
                <p className="pb-4">{item.description}</p>
                {item.price && <p className="font-semibold">→ Desde {item.price}</p>}
                {item.timeframe && <p className="font-semibold">→ Entrega en {item.timeframe}</p>}
              </div>
            ))}
          </div>
        </section>
      )

    case 'testimonials':
      return (
        <section className="w-full py-20 border-t border-neutral-300">
          <div className="reading-container">
            {block.heading && <h2 className="font-bold">{block.heading}</h2>}
          </div>
          <div className="container grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(block.items || []).map((item: any, i: number) => (
              <div key={i} className="bg-[#edeae3] p-8 flex flex-col">
                <p className="mb-8 flex-grow">{item.message}</p>
                <p className="-ft-1 mt-auto font-semibold text-right">— {item.name}</p>
              </div>
            ))}
          </div>
        </section>
      )

    case 'faq':
      return (
        <section className="w-full py-20 border-y border-neutral-400">
          <div className="reading-container">
            {block.heading && <h2 className="ft-6 font-bold">{block.heading}</h2>}
          </div>
          <div className="container">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(block.items || []).map((item: any, i: number) => (
              <div key={i} className="border-t border-[#1a1814]/10 last:border-b py-6">
                <h3 className="font-medium">{item.question}</h3>
                <p className="pt-2 max-w-[600px] text-neutral-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )

    case 'ctaFinal':
      return (
        <section className="w-full py-20">
          <div className="reading-container">
            <h2 className="font-bold">{block.heading}</h2>
            {block.body && <p>{block.body}</p>}
            <Link
              href={block.ctaTarget === 'quiz' ? 'survey' : block.ctaLink || '#'}
              className="button !bg-brand-2 !text-white"
            >
              {block.ctaLabel || 'Continuar'}
            </Link>
          </div>
        </section>
      )

    default:
      return null
  }
}

export default async function TenantLanding({ params }: TenantLandingProps) {
  const { subdomain } = await params
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) notFound()

  const hero = tenant.landingHero
  const hasLanding = Boolean(hero?.title?.trim()) || Boolean(tenant.landingBlocks?.length)

  // Landing "nullable": si el tenant no configuró título ni bloques, se
  // omite la landing y se va directo al quiz.
  //
  // `redirect()` de Next siempre construye el Location a partir de la raíz
  // del host actual (no del pathname reescrito por el middleware). Cuando
  // esta página se sirve vía el subdominio real del tenant, el host YA es
  // ese subdominio, así que "/survey" cae en el lugar correcto. Pero cuando
  // se accede directo a /tenant-site/{subdomain} (preview desde el admin,
  // mismo host que /admin), "/survey" caería en la raíz del admin y no en
  // /tenant-site/{subdomain}/survey. Detectamos el caso y ajustamos el target.
  if (!hasLanding) {
    const host = (await headers()).get('host') || ''
    const isRealTenantHost = getSubdomainFromHost(host, ROOT_DOMAIN) === subdomain
    redirect(isRealTenantHost ? '/survey' : `/tenant-site/${subdomain}/survey`)
  }

  return (
    <main>
      {hero?.title && (
        <div className="px-10 py-12">
          <h1 className="ft-8 font-bold text-[#1a1814]">{hero.title}</h1>
          {hero.subtitle && <p className="ft-2 mt-4 text-neutral-600">{hero.subtitle}</p>}
          {hero.ctaLabel && (
            <Link href={hero.ctaLink || 'survey'} className="button !bg-brand-2 !text-white mt-8 inline-block">
              {hero.ctaLabel}
            </Link>
          )}
        </div>
      )}

      {(tenant.landingBlocks || []).map((block, i) => (
        <LandingBlock key={i} block={block} />
      ))}
    </main>
  )
}
