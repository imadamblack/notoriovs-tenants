// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { Tenants } from '@/collections/Tenants'
import {
  TENANT_SITE_REVALIDATE_SECONDS,
  revalidateTenantSite,
  tenantSitePath,
} from '@/utils/tenantSiteCache'

const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))

// Solo se le pide `logger`; el resto de Payload no participa.
const payloadStub = { logger: { warn: vi.fn() } }
const payload = payloadStub as unknown as Parameters<typeof revalidateTenantSite>[1]

beforeEach(() => {
  revalidatePath.mockReset()
  payloadStub.logger.warn.mockReset()
})

describe('tenantSitePath', () => {
  it('normaliza el subdominio a minúsculas, como la consulta del tenant', () => {
    // buildTenantQuery busca por `subdomain.toLowerCase()`, así que la ruta
    // que se invalida tiene que coincidir con la que se sirvió.
    expect(tenantSitePath('MiTenant')).toBe('/tenant-site/mitenant')
  })
})

describe('revalidateTenantSite', () => {
  it('invalida el segmento completo, no página por página', async () => {
    // 'layout' arrastra landing, survey, thankyou, not-elegible y
    // privacy-notice. Si esto fuera una lista de rutas, una página nueva
    // nacería sin invalidación y nadie se enteraría.
    await revalidateTenantSite(['acme'], payload)

    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tenant-site/acme', 'layout')
  })

  it('invalida el subdominio viejo y el nuevo cuando cambia', async () => {
    await revalidateTenantSite(['nuevo', 'viejo'], payload)

    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/tenant-site/nuevo',
      '/tenant-site/viejo',
    ])
  })

  it('no repite la invalidación cuando el subdominio no cambió', async () => {
    // El caso normal de un update: `doc.subdomain` y `previousDoc.subdomain`
    // son el mismo.
    await revalidateTenantSite(['acme', 'acme'], payload)

    expect(revalidatePath).toHaveBeenCalledTimes(1)
  })

  it('ignora los subdominios vacíos que llegan en un create', async () => {
    // En `create` no hay `previousDoc`.
    await revalidateTenantSite(['acme', undefined, null, '  '], payload)

    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tenant-site/acme', 'layout')
  })

  it('no toca la caché si no hay nada que invalidar', async () => {
    await revalidateTenantSite([null, undefined], payload)

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('no revienta el guardado si la invalidación falla: avisa y sigue', async () => {
    // Fire-and-forget, como el resto de efectos externos del repo. Un
    // `revalidatePath` fuera de contexto de request (un seed, un script) no
    // puede impedir que el tenant se guarde.
    revalidatePath.mockImplementation(() => {
      throw new Error('static generation store missing')
    })

    await expect(revalidateTenantSite(['acme'], payload)).resolves.toBeUndefined()
    expect(payloadStub.logger.warn).toHaveBeenCalledOnce()
    expect(payloadStub.logger.warn.mock.calls[0][0]).toContain('acme')
  })
})

const TENANT_SITE_DIR = path.join(process.cwd(), 'src/app/(frontend)/tenant-site/[subdomain]')

/** Todas las `page.tsx` bajo /tenant-site/[subdomain], a cualquier profundidad. */
function tenantPages(dir: string = TENANT_SITE_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return tenantPages(full)
    return entry.name === 'page.tsx' ? [full] : []
  })
}

describe('configuración de caché de las páginas del tenant', () => {
  const pages = tenantPages().map((file) => [path.relative(TENANT_SITE_DIR, file), file] as const)

  it('encuentra las páginas del tenant', () => {
    // Si el glob se rompe, el resto de este describe pasaría en vacío.
    expect(pages.length).toBeGreaterThanOrEqual(6)
  })

  it.each(pages)('%s declara caché o se marca dinámica, nunca las dos', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    const revalidate = source.match(/^export const revalidate = (\d+)$/m)
    const forcedDynamic = /^export const dynamic = 'force-dynamic'$/m.test(source)

    // Una página pública nueva que se olvide de esto se serviría dinámica y
    // volvería a pegarle a Postgres en cada clic de anuncio, sin que nada
    // avise. La otra mitad de la regla es que el dashboard no puede terminar
    // en el CDN por descuido.
    expect(Boolean(revalidate) !== forcedDynamic, 'declara exactamente una de las dos').toBe(true)

    // Next lee `revalidate` con análisis estático y rechaza una constante
    // importada, así que el literal se repite en cada página. Esto es lo que
    // impide que se separe de TENANT_SITE_REVALIDATE_SECONDS, que es el
    // número del que habla el log de `revalidateTenantSite`.
    if (revalidate) expect(Number(revalidate[1])).toBe(TENANT_SITE_REVALIDATE_SECONDS)
  })

  it('el dashboard es el único que se sirve dinámico', () => {
    const dynamicPages = pages
      .filter(([, file]) => /^export const dynamic = 'force-dynamic'$/m.test(readFileSync(file, 'utf8')))
      .map(([name]) => name)

    expect(dynamicPages).toEqual([path.join('dashboard', 'page.tsx')])
  })
})

describe('hooks del Tenant', () => {
  // Los hooks se invocan directo, sin base: lo que se verifica es el cableado
  // —que guardar un Tenant llegue a invalidar su sitio—, no Payload.
  const run = async (
    hook: 'afterChange' | 'afterDelete',
    args: { doc: { subdomain: string }; previousDoc?: { subdomain: string } },
  ) => {
    const hooks = Tenants.hooks?.[hook]
    expect(hooks?.length, `${hook} sin hooks`).toBeTruthy()
    // El de la caché es el primero: si n8n tarda, la página del cliente ya
    // se refrescó.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (hooks as any)[0]({ ...args, req: { payload } })
  }

  it('guardar un tenant refresca su sitio', async () => {
    await run('afterChange', { doc: { subdomain: 'acme' }, previousDoc: { subdomain: 'acme' } })

    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tenant-site/acme', 'layout')
  })

  it('renombrar el subdominio baja el sitio viejo y publica el nuevo', async () => {
    await run('afterChange', { doc: { subdomain: 'acme-mx' }, previousDoc: { subdomain: 'acme' } })

    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/tenant-site/acme-mx',
      '/tenant-site/acme',
    ])
  })

  it('borrar un tenant baja su sitio', async () => {
    // Sin esto la página cacheada le sobreviviría al documento.
    await run('afterDelete', { doc: { subdomain: 'acme' } })

    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/tenant-site/acme', 'layout')
  })
})
