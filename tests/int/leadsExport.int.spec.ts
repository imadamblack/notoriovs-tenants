// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// La exportación a CSV es la principal vía por la que los datos personales de
// los Leads de un cliente salen en bloque de la plataforma. Lo que se prueba
// aquí es exactamente eso: que el archivo solo pueda traer leads del tenant
// del host, y que cada descarga quede registrada. El armado del CSV se ejerce
// de paso, porque es lo que demuestra qué datos viajan realmente adentro.
//
// Sin base de datos: Postgres se sustituye por dobles. Lo que puede romperse
// aquí no es la consulta sino la regla, igual que en dashboardAuth.

const getTenantBySubdomain = vi.fn()
const getTenantUserSession = vi.fn()
const find = vi.fn()
const count = vi.fn()
const create = vi.fn()

vi.mock('@/utils/getTenant', () => ({
  getTenantBySubdomain: (...args: unknown[]) => getTenantBySubdomain(...args),
}))

vi.mock('@/utils/tenantUserAuth', () => ({
  getTenantUserSession: (...args: unknown[]) => getTenantUserSession(...args),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
  getPayload: async () => ({ find, count, create }),
}))

const { GET } = await import('@/app/api/tenant-dashboard/leads/export/route')

const ACME_ID = 1

/** El tenant tal como lo ve la exportación: pipeline + pasos del quiz. */
const ACME = {
  id: ACME_ID,
  leadStuckAfterDays: 21,
  leadPipeline: [
    { id: 'stage-nuevo', label: 'Nuevo' },
    { id: 'stage-ganado', label: 'Cerrado', isWon: true },
  ],
  quizSteps: [
    { type: 'radio', name: 'recamaras', title: '¿Cuántas <b>recámaras</b> buscas?', options: [
      { label: 'Dos', value: '2' },
      { label: 'Tres o más', value: '3+' },
    ] },
    { type: 'checkpoint', name: 'video', title: 'Mira esto' },
    { type: 'text', name: 'presupuesto', title: '¿Presupuesto?' },
    { type: 'opt-in', name: 'contacto', title: 'Tus datos' },
  ],
}

const tenantUser = (tenantId: string | number) => ({
  id: 7,
  email: 'cliente@acme.com',
  tenantId,
  role: 'owner' as const,
})

const exportRequest = (query = '', host = 'acme.localhost:3000') =>
  new NextRequest(`http://${host}/api/tenant-dashboard/leads/export${query}`, {
    headers: { host },
  })

/** Una página de resultados de `payload.find`. */
const pageOf = (docs: unknown[], hasNextPage = false) => ({ docs, hasNextPage })

const LEAD = {
  name: 'Ana Martínez',
  phone: '3312345678',
  whatsapp: '',
  email: 'ana@example.com',
  stage: 'stage-nuevo',
  status: 'open',
  source: 'quiz',
  notes: 'Habló el martes',
  answers: { nombre: 'Ana Martínez', recamaras: '3+', presupuesto: '2 millones', obsoleta: 'sí' },
  createdAt: '2026-09-01T15:30:00.000Z',
  updatedAt: '2026-09-02T15:30:00.000Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  getTenantBySubdomain.mockResolvedValue(ACME)
  getTenantUserSession.mockResolvedValue(tenantUser(ACME_ID))
  count.mockResolvedValue({ totalDocs: 1 })
  create.mockResolvedValue({ id: 99 })
  find.mockResolvedValue(pageOf([LEAD]))
})

describe('exportación de leads a CSV', () => {
  it('sin sesión no entrega nada', async () => {
    getTenantUserSession.mockResolvedValue(null)

    const res = await GET(exportRequest())

    expect(res.status).toBe(401)
    expect(find).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  // El caso que justifica la prueba: la sesión es legítima, pero es de otro
  // cliente. Un CSV es la fuga más barata que existe, así que no basta con que
  // la consulta esté scopeada: la petición no debe llegar siquiera a hacerla.
  it('un Tenant User de otro cliente no exporta los leads de este', async () => {
    getTenantUserSession.mockResolvedValue(tenantUser(2))

    const res = await GET(exportRequest())

    expect(res.status).toBe(401)
    expect(find).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('la consulta va siempre acotada al tenant del host, con los filtros de la pantalla', async () => {
    const res = await GET(exportRequest('?status=won&since=30d&search=ana&stage=stage-nuevo'))
    await res.text()

    // La etapa se descarta a propósito: se exporta el tablero completo, no la
    // columna que el Kanban tuviera abierta.
    const where = find.mock.calls[0][0].where
    expect(where.and[0]).toEqual({ tenant: { equals: ACME_ID } })
    expect(JSON.stringify(where)).not.toContain('stage-nuevo')
    expect(where.and).toContainEqual({ status: { equals: 'won' } })
    expect(where.and).toContainEqual({
      or: [
        { name: { contains: 'ana' } },
        { phone: { contains: 'ana' } },
        { whatsapp: { contains: 'ana' } },
        { email: { contains: 'ana' } },
      ],
    })

    // El mismo `where` que cuenta es el que trae los documentos: si se
    // separaran, el número que queda en la bitácora no sería el del archivo.
    expect(count.mock.calls[0][0].where).toEqual(where)
  })

  it('registra quién exportó, cuántos leads y con qué filtros', async () => {
    count.mockResolvedValue({ totalDocs: 42 })

    const res = await GET(exportRequest('?status=won&since=30d&search=ana'))
    await res.text()

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({
      collection: 'lead-exports',
      data: {
        tenant: ACME_ID,
        exportedBy: 7,
        exportedByEmail: 'cliente@acme.com',
        leadCount: 42,
        filtersLabel: 'status: won, periodo: 30d, búsqueda: "ana"',
      },
    })
  })

  it('el archivo trae los campos fijos y una columna por pregunta del quiz', async () => {
    const res = await GET(exportRequest())
    const bytes = await res.arrayBuffer()
    const body = new TextDecoder('utf-8').decode(bytes)
    const [header, row] = body.split('\r\n')

    // BOM al inicio: es lo que hace que Excel en español lea "Martínez" y no
    // "MartÃ­nez". Se comprueba en bytes crudos porque `Response.text()` se
    // come el BOM al decodificar, y entonces la prueba pasaría sin él.
    expect([...new Uint8Array(bytes.slice(0, 3))]).toEqual([0xef, 0xbb, 0xbf])
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('leads-acme-')

    const headers = header.replace('\uFEFF', '').split(';')
    expect(headers.slice(0, 4)).toEqual(['Nombre', 'Teléfono', 'WhatsApp', 'Correo'])
    // El encabezado es el título de la pregunta sin el HTML con el que se
    // pinta en el quiz, y en el orden del quiz. El checkpoint (que no tiene
    // respuesta) y el opt-in (que ya viaja en las columnas de contacto) no
    // son columnas.
    expect(headers).toContain('¿Cuántas recámaras buscas?')
    expect(headers).not.toContain('Mira esto')
    expect(headers.indexOf('¿Cuántas recámaras buscas?')).toBeLessThan(
      headers.indexOf('¿Presupuesto?'),
    )

    const cells = row.split(';')
    expect(cells[0]).toBe('Ana Martínez')
    expect(cells[headers.indexOf('Etapa')]).toBe('Nuevo')
    expect(cells[headers.indexOf('Resultado')]).toBe('Abierto')
    // La respuesta se guarda por `value` ("3+"); en la hoja va la etiqueta
    // que el lead vio en pantalla.
    expect(cells[headers.indexOf('¿Cuántas recámaras buscas?')]).toBe('Tres o más')
    // Una pregunta que ya no está en el quiz no se pierde en silencio.
    expect(cells[headers.indexOf('Otras respuestas')]).toBe('obsoleta: sí')
  })

  it('pagina hasta traerlos todos, no solo la primera página', async () => {
    find
      .mockResolvedValueOnce(pageOf([LEAD, LEAD], true))
      .mockResolvedValueOnce(pageOf([LEAD], false))

    const body = await (await GET(exportRequest())).text()

    expect(find).toHaveBeenCalledTimes(2)
    // Encabezado + 3 leads (la última línea queda vacía tras el CRLF final).
    expect(body.trimEnd().split('\r\n')).toHaveLength(4)
  })
})
