// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildWeekBuckets,
  fullWeekWindow,
  normalizeSinceKey,
  sinceCutoffISO,
  trendStartMs,
  weekStartUTC,
} from '@/utils/dashboardPeriod'

const DAY = 86400000
const WEEK = 7 * DAY

// Miércoles 2026-03-11 12:00 UTC. El lunes de esa semana es 2026-03-09.
const NOW = Date.parse('2026-03-11T12:00:00.000Z')

describe('normalizeSinceKey', () => {
  it('cae en "all" con cualquier valor que no sea un preset', () => {
    expect(normalizeSinceKey(null)).toBe('all')
    expect(normalizeSinceKey('')).toBe('all')
    expect(normalizeSinceKey('90d')).toBe('all')
    expect(normalizeSinceKey('7d')).toBe('7d')
  })
})

describe('sinceCutoffISO', () => {
  it('es una ventana rodante desde ahora, no un día de calendario', () => {
    expect(sinceCutoffISO('today', NOW)).toBe(new Date(NOW - DAY).toISOString())
    expect(sinceCutoffISO('3m', NOW)).toBe(new Date(NOW - 90 * DAY).toISOString())
  })

  it('no corta nada con "all"', () => {
    expect(sinceCutoffISO('all', NOW)).toBeUndefined()
  })
})

describe('weekStartUTC', () => {
  it('devuelve el lunes 00:00 UTC, también en domingo', () => {
    expect(weekStartUTC(new Date('2026-03-11T12:00:00Z')).toISOString()).toBe('2026-03-09T00:00:00.000Z')
    expect(weekStartUTC(new Date('2026-03-15T23:59:00Z')).toISOString()).toBe('2026-03-09T00:00:00.000Z')
    expect(weekStartUTC(new Date('2026-03-09T00:00:00Z')).toISOString()).toBe('2026-03-09T00:00:00.000Z')
  })
})

describe('buildWeekBuckets', () => {
  it('recorta la primera y la última semana al rango, para que las barras sumen el total', () => {
    const buckets = buildWeekBuckets(NOW - 30 * DAY, NOW)
    expect(buckets[0].startISO).toBe(new Date(NOW - 30 * DAY).toISOString())
    expect(buckets[buckets.length - 1].endISO).toBe(new Date(NOW).toISOString())
  })

  it('no deja huecos ni traslapes entre semanas consecutivas', () => {
    const buckets = buildWeekBuckets(NOW - 30 * DAY, NOW)
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].startISO).toBe(buckets[i - 1].endISO)
    }
  })

  it('etiqueta cada barra con el lunes de su semana', () => {
    const buckets = buildWeekBuckets(Date.parse('2026-03-09T00:00:00Z'), NOW)
    expect(buckets.map((b) => b.week)).toEqual(['2026-03-09'])
  })

  it('nunca pasa del tope de barras', () => {
    expect(buildWeekBuckets(NOW - 365 * DAY, NOW).length).toBe(14)
  })

  it('devuelve vacío con un rango invertido o de longitud cero', () => {
    expect(buildWeekBuckets(NOW, NOW)).toEqual([])
    expect(buildWeekBuckets(NOW, NOW - DAY)).toEqual([])
  })
})

describe('trendStartMs', () => {
  it('con "Máximo" arranca 8 semanas atrás, alineado a lunes', () => {
    const start = trendStartMs('all', NOW)
    expect(new Date(start).toISOString()).toBe('2026-01-19T00:00:00.000Z')
    expect(buildWeekBuckets(start, NOW).length).toBe(8)
  })

  it('con un preset arranca en el corte del propio periodo', () => {
    expect(trendStartMs('30d', NOW)).toBe(NOW - 30 * DAY)
  })
})

describe('fullWeekWindow', () => {
  it('termina justo antes del lunes de la semana en curso (nunca incluye la semana viva)', () => {
    expect(fullWeekWindow('30d', NOW).endISO).toBe('2026-03-08T23:59:59.999Z')
    expect(fullWeekWindow('all', NOW).endISO).toBe('2026-03-08T23:59:59.999Z')
  })

  it('con "Máximo" no pone piso', () => {
    expect(fullWeekWindow('all', NOW).startISO).toBeUndefined()
  })

  it('redondea hacia adentro: si el corte cae a media semana, esa semana queda fuera', () => {
    // NOW - 30d = 2026-02-09T12:00Z (lunes al mediodía). El lunes 02-09
    // ya empezó antes del corte, así que la ventana arranca el 02-16.
    expect(fullWeekWindow('30d', NOW).startISO).toBe('2026-02-16T00:00:00.000Z')
  })

  it('respeta un corte que cae exactamente en lunes 00:00', () => {
    const mondayNow = Date.parse('2026-03-09T00:00:00.000Z') + 7 * DAY
    expect(fullWeekWindow('7d', mondayNow).startISO).toBe('2026-03-09T00:00:00.000Z')
  })

  it('la ventana siempre es un número entero de semanas', () => {
    const { startISO, endISO } = fullWeekWindow('3m', NOW)
    const span = Date.parse(endISO) + 1 - Date.parse(startISO!)
    expect(span % WEEK).toBe(0)
  })
})
