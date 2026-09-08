// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  TENANT_PROJECTIONS,
  PUBLIC_TENANT_PROJECTIONS,
  buildTenantQuery,
  type TenantProjectionName,
} from '@/utils/getTenant'

// Campos del Tenant que nunca deben viajar a una página pública: el token de
// la Conversions API de Meta (permite escribir eventos en el Pixel del
// cliente) y la contraseña compartida del dashboard.
const SECRETS = {
  tracking: ['metaCapiToken'],
  dashboardPassword: [],
} as const

describe('proyecciones del tenant', () => {
  it('ninguna proyección pública incluye el token de CAPI ni la contraseña del dashboard', () => {
    for (const name of PUBLIC_TENANT_PROJECTIONS) {
      const projection: Record<string, unknown> = TENANT_PROJECTIONS[name]

      for (const [field, subfields] of Object.entries(SECRETS)) {
        const selected = projection[field]
        if (selected === undefined) continue

        // Un grupo pedido entero (`true`) arrastra todos sus subcampos, así
        // que un grupo con secretos solo puede pedirse subcampo por subcampo.
        expect(selected, `${name}.${field} pide el grupo completo`).not.toBe(true)
        for (const subfield of subfields) {
          expect(selected, `${name}.${field}.${subfield}`).not.toHaveProperty(subfield)
        }
        if (!subfields.length) {
          expect.unreachable(`la proyección pública "${name}" pide el campo secreto "${field}"`)
        }
      }
    }
  })

  it('la landing pide identidad, hero, bloques y solo el tracking público', () => {
    // La identidad y el tracking los pide el layout que envuelve a todas las
    // páginas del tenant (`chrome`); el hero y los bloques, la landing misma.
    expect(TENANT_PROJECTIONS.chrome).toMatchObject({
      name: true,
      generalInfo: true,
      tracking: { metaPixelId: true, googleTagId: true },
    })
    expect(TENANT_PROJECTIONS.chrome).not.toHaveProperty('landingBlocks')
    expect(TENANT_PROJECTIONS.chrome).not.toHaveProperty('quizSteps')
    expect(TENANT_PROJECTIONS.chrome).not.toHaveProperty('leadPipeline')

    expect(TENANT_PROJECTIONS.landing).toMatchObject({
      landingHero: true,
      landingBlocks: true,
    })
  })

  it('el quiz pide sus pasos y el dashboard su pipeline', () => {
    expect(TENANT_PROJECTIONS.quiz).toMatchObject({ quizSteps: true })
    expect(TENANT_PROJECTIONS.quiz).not.toHaveProperty('leadPipeline')

    expect(TENANT_PROJECTIONS.dashboard).toMatchObject({ leadPipeline: true })
    expect(TENANT_PROJECTIONS.dashboard).not.toHaveProperty('quizSteps')
    expect(TENANT_PROJECTIONS.dashboard).not.toHaveProperty('landingBlocks')
  })

  it('la query filtra por subdominio normalizado y tenant activo, y proyecta', () => {
    const query = buildTenantQuery('MiTenant', 'landing')

    expect(query).toEqual({
      collection: 'tenants',
      where: {
        subdomain: { equals: 'mitenant' },
        active: { equals: true },
      },
      limit: 1,
      depth: 1,
      select: TENANT_PROJECTIONS.landing,
    })
  })

  it('cada proyección es un select válido: solo `true` o subcampos en `true`', () => {
    for (const name of Object.keys(TENANT_PROJECTIONS) as TenantProjectionName[]) {
      for (const [field, value] of Object.entries(TENANT_PROJECTIONS[name])) {
        if (value === true) continue
        expect(typeof value, `${name}.${field}`).toBe('object')
        expect(Object.values(value as object), `${name}.${field}`).toEqual(
          Object.values(value as object).map(() => true),
        )
      }
    }
  })
})
