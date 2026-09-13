// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  TENANT_PROJECTIONS,
  PUBLIC_TENANT_PROJECTIONS,
  ACTIVE_ONLY_TENANT_PROJECTIONS,
  TENANT_SITE_PROJECTIONS,
  buildTenantQuery,
  type TenantProjectionName,
} from '@/utils/getTenant'

// Lo único del Tenant que nunca debe viajar a una página pública: el token de
// la Conversions API, que permite escribir eventos en el Pixel del cliente.
// Vive dentro de `tracking`, junto a datos que sí son públicos, así que la
// regla es sobre el subcampo. (`dashboardPassword` estuvo aquí hasta que se
// retiró la contraseña compartida.)
const SECRET_SUBFIELDS = { tracking: ['metaCapiToken'] } as const

describe('proyecciones del tenant', () => {
  it('ninguna proyección pública incluye el token de CAPI', () => {
    for (const name of PUBLIC_TENANT_PROJECTIONS) {
      const select: Record<string, unknown> = TENANT_PROJECTIONS[name].select

      for (const [group, subfields] of Object.entries(SECRET_SUBFIELDS)) {
        const selected = select[group]
        if (selected === undefined) continue

        // Un grupo pedido entero (`true`) arrastra todos sus subcampos, así
        // que un grupo con secretos solo puede pedirse subcampo por subcampo.
        expect(selected, `${name}.${group} pide el grupo completo`).not.toBe(true)
        for (const subfield of subfields) {
          expect(selected, `${name}.${group}.${subfield}`).not.toHaveProperty(subfield)
        }
      }
    }
  })

  it('la landing pide identidad, hero, bloques y solo el tracking público', () => {
    // La identidad y el tracking los pide el layout que envuelve a todas las
    // páginas del tenant (`chrome`); el hero y los bloques, la landing misma.
    expect(TENANT_PROJECTIONS.chrome.select).toMatchObject({
      name: true,
      generalInfo: true,
      tracking: { metaPixelId: true, googleTagId: true },
    })
    expect(TENANT_PROJECTIONS.chrome.select).not.toHaveProperty('landingBlocks')
    expect(TENANT_PROJECTIONS.chrome.select).not.toHaveProperty('quizSteps')
    expect(TENANT_PROJECTIONS.chrome.select).not.toHaveProperty('leadPipeline')

    expect(TENANT_PROJECTIONS.landing.select).toMatchObject({
      landingHero: true,
      landingBlocks: true,
    })
  })

  it('el quiz pide sus pasos y el dashboard su pipeline', () => {
    expect(TENANT_PROJECTIONS.quiz.select).toMatchObject({ quizSteps: true })
    expect(TENANT_PROJECTIONS.quiz.select).not.toHaveProperty('leadPipeline')

    // La página del dashboard sí carga el quiz: el panel de detalle deja
    // corregir respuestas y necesita la pregunta (título y opciones) para
    // hacerlo. Es una vez por carga de página, no por consulta del Kanban.
    expect(TENANT_PROJECTIONS.dashboard.select).toMatchObject({ leadPipeline: true, quizSteps: true })
    expect(TENANT_PROJECTIONS.dashboard.select).not.toHaveProperty('landingBlocks')
  })

  // El quiz solo lo cargan las rutas que lo necesitan: la exportación a CSV
  // (sus columnas de respuestas) y la corrección de una respuesta. Que las
  // del Kanban NO lo hagan es lo que evita arrastrar el quiz entero en cada
  // una de las decenas de consultas de una sesión.
  it('el quiz junto con el pipeline solo viaja en su propia proyección', () => {
    expect(TENANT_PROJECTIONS.dashboardQuiz.select).toMatchObject({
      leadPipeline: true,
      quizSteps: true,
    })
    expect(TENANT_PROJECTIONS.dashboardApi.select).not.toHaveProperty('quizSteps')
  })

  it('solo pobla relaciones (depth 1) la proyección que pinta una Media', () => {
    // `depth: 1` es un join más por consulta; las proyecciones de las rutas
    // de API no pintan nada, así que no lo pagan.
    for (const name of ['dashboardApi', 'dashboardQuiz', 'conversionsApi', 'quizSubmit', 'identity'] as const) {
      expect(TENANT_PROJECTIONS[name].depth, name).toBe(0)
    }
    for (const name of ['chrome', 'quiz', 'thankYou', 'notEligible'] as const) {
      expect(TENANT_PROJECTIONS[name].depth, name).toBe(1)
    }
  })

  it('la query filtra por subdominio normalizado y proyecta', () => {
    const query = buildTenantQuery('MiTenant', 'landing')

    expect(query).toEqual({
      collection: 'tenants',
      where: { subdomain: { equals: 'mitenant' } },
      limit: 1,
      depth: TENANT_PROJECTIONS.landing.depth,
      select: TENANT_PROJECTIONS.landing.select,
    })
  })

  // El corazón del issue 23: `active` es la suscripción, no la publicación.
  // Un Tenant inactivo tiene sus anuncios corriendo; cerrarle la landing o el
  // quiz le quema el presupuesto sin que se entere.
  it('ninguna proyección del sitio público exige un Tenant activo', () => {
    for (const name of TENANT_SITE_PROJECTIONS) {
      expect(ACTIVE_ONLY_TENANT_PROJECTIONS, name).not.toContain(name)
      expect(buildTenantQuery('acme', name).where, name).not.toHaveProperty('active')
    }
  })

  it('el dashboard y lo que da acceso a él sí exigen un Tenant activo', () => {
    // `dashboardApi` es la que autoriza TODAS las rutas /api/tenant-dashboard
    // (ver `resolveDashboardAuth`), así que cerrarla aquí las cierra todas.
    for (const name of ['dashboardApi', 'dashboardQuiz', 'dashboardIdentity', 'tenantMail'] as const) {
      expect(ACTIVE_ONLY_TENANT_PROJECTIONS, name).toContain(name)
      expect(buildTenantQuery('acme', name).where, name).toMatchObject({
        active: { equals: true },
      })
    }
  })

  // La página del dashboard es la excepción deliberada: resuelve el tenant
  // inactivo para poder mostrarle el aviso de "no disponible" en vez de un 404
  // que diría que su sitio no existe. Quien cierra la puerta ahí es
  // `tenantHasDashboard`.
  it('la página del dashboard resuelve el tenant aunque esté inactivo', () => {
    expect(ACTIVE_ONLY_TENANT_PROJECTIONS).not.toContain('dashboard')
    expect(buildTenantQuery('acme', 'dashboard').where).not.toHaveProperty('active')
  })

  // El ingest de leads sostiene la captura desde el quiz, y el de marketing
  // reports es la tubería interna de Notoriovs: ninguno de los dos depende de
  // que el cliente esté al corriente.
  it('los ingests resuelven un tenant inactivo', () => {
    for (const name of ['leadIngest', 'identity'] as const) {
      expect(ACTIVE_ONLY_TENANT_PROJECTIONS, name).not.toContain(name)
    }
  })

  it('cada proyección es un select válido: solo `true` o subcampos en `true`', () => {
    for (const name of Object.keys(TENANT_PROJECTIONS) as TenantProjectionName[]) {
      for (const [field, value] of Object.entries(TENANT_PROJECTIONS[name].select)) {
        if (value === true) continue
        expect(typeof value, `${name}.${field}`).toBe('object')
        expect(Object.values(value as object), `${name}.${field}`).toEqual(
          Object.values(value as object).map(() => true),
        )
      }
    }
  })
})
