import type { CollectionConfig } from 'payload'

// Métricas semanales de las campañas de ads por tenant (hoy viven en un
// Google Sheet por cliente, ver ejemplo compartido: date_start, date_stop,
// campaign, impressions, reach, frequency, cpm, clicks, ctr,
// landing_page_views, leads, cost_per_lead, spend, ads). Se ingesta vía
// POST /api/marketing-reports/ingest (server-to-server, protegido con
// MARKETING_REPORT_INGEST_KEY) para que el workflow de n8n que ya arma
// estos números pueda empujarlos aquí en vez de (o además de) al Sheet.
//
// Igual que en Leads.ts: el campo `tenant` lo agrega `multiTenantPlugin`
// (ver payload.config.ts), no está a mano en `fields`.
export const MarketingReports: CollectionConfig = {
  slug: 'marketing-reports',
  admin: {
    useAsTitle: 'campaign',
    defaultColumns: ['tenant', 'campaign', 'weekStart', 'weekEnd', 'leads', 'spend'],
    description: 'KPIs semanales de campañas de ads por tenant (ingesta desde n8n).',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'weekStart', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
        { name: 'weekEnd', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly' } } },
      ],
    },
    { name: 'campaign', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'impressions', type: 'number' },
        { name: 'reach', type: 'number' },
        { name: 'frequency', type: 'number' },
        { name: 'cpm', type: 'number', admin: { description: 'MXN' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'clicks', type: 'number' },
        { name: 'ctr', type: 'number', admin: { description: 'Porcentaje, ej: 0.91' } },
        { name: 'landingPageViews', type: 'number' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'leads', type: 'number' },
        { name: 'costPerLead', type: 'number', admin: { description: 'MXN' } },
        { name: 'spend', type: 'number', admin: { description: 'MXN' } },
      ],
    },
    { name: 'ads', type: 'text', hasMany: true, label: 'Anuncios activos esa semana' },
  ],
  // Mismo criterio que en Leads.ts: el reporte de KPIs siempre pide "las
  // filas de este tenant, más recientes primero".
  indexes: [{ fields: ['tenant', 'weekStart'] }],
  timestamps: true,
}
