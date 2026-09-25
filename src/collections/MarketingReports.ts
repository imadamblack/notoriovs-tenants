import type { CollectionConfig } from 'payload'
import { isInternalUser } from '@/access/isInternalUser'
import { scopeBulkToSelectedTenant } from './scopeBulkToSelectedTenant'

// Un Marketing Report es UN DÍA de una campaña de un tenant (issue #19: antes
// era una semana). Semana, mes o cualquier otro rango se calculan en
// plataforma sumando días — no se vuelven a ingestar por separado. Se
// ingesta vía POST /api/marketing-reports/ingest (server-to-server,
// protegido con MARKETING_REPORT_INGEST_KEY) desde un job de n8n que corre
// diario y trae una ventana móvil de los últimos 7 días, PISANDO lo que ya
// había: Meta corrige la atribución hacia atrás durante dos o tres días, y
// la llave (tenant, campaign, date) es lo que hace que pisar sea seguro.
//
// `reach` y `frequency` NO se guardan: no se pueden reconstruir sumando
// días (la misma persona alcanzada el lunes y el jueves cuenta una vez en
// la semana) y no son métricas que le importen al dueño del negocio.
//
// `cpm`, `ctr` y `costPerLead` TAMPOCO se guardan aquí a propósito: son
// divisiones, y una columna con el promedio diario invita a que alguien la
// promedie por error. Se calculan siempre al vuelo sobre la ventana pedida,
// en /api/tenant-dashboard/kpis.
//
// Igual que en Leads.ts: el campo `tenant` lo agrega `multiTenantPlugin`
// (ver payload.config.ts), no está a mano en `fields`.
export const MarketingReports: CollectionConfig = {
  slug: 'marketing-reports',
  admin: {
    useAsTitle: 'campaign',
    defaultColumns: ['tenant', 'campaign', 'date', 'leads', 'spend'],
    description: 'KPIs diarios de campañas de ads por tenant (ingesta desde n8n).',
  },
  hooks: {
    // Igual que en Leads: "Select all" + Edit/Delete no se sale del tenant elegido.
    beforeOperation: [scopeBulkToSelectedTenant],
  },
  access: {
    // Internos, no "cualquiera autenticado": ver la nota en `isInternalUser`.
    // Los KPIs de gasto que ve el cliente salen por /api/tenant-dashboard/kpis,
    // que filtra por el tenant del host.
    read: isInternalUser,
    create: isInternalUser,
    update: isInternalUser,
    delete: isInternalUser,
  },
  fields: [
    { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
    { name: 'campaign', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'impressions', type: 'number' },
        { name: 'clicks', type: 'number' },
        { name: 'landingPageViews', type: 'number' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'leads', type: 'number' },
        { name: 'spend', type: 'number', admin: { description: 'MXN' } },
      ],
    },
    { name: 'ads', type: 'text', hasMany: true, label: 'Anuncios activos ese día' },
  ],
  // Mismo criterio que en Leads.ts: el reporte de KPIs siempre pide "las
  // filas de este tenant, más recientes primero". Y es la llave del upsert
  // en /ingest: un (tenant, campaign, date) determina una fila única.
  indexes: [{ fields: ['tenant', 'date'] }],
  timestamps: true,
}
