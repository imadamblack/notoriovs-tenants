import React from 'react'
import Link from 'next/link'
import {getPayload} from 'payload'
import config from '@payload-config'

const ArrowOutward = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />
  </svg>
)

// Server Component (RSC) para el admin de Payload. Se registra vía
// admin.components.beforeDashboard en payload.config.ts.
export const TenantsDashboardWidget: React.FC = async () => {
  const payload = await getPayload({config})

  const [all, active] = await Promise.all([
    payload.find({
      collection: 'tenants',
      limit: 100,
      depth: 0,
      sort: 'name',
      select: {name: true, subdomain: true, active: true},
    }),
    payload.count({
      collection: 'tenants',
      where: {active: {equals: true}},
    }),
  ])

  const total = all.totalDocs
  const activeCount = active.totalDocs
  const inactiveCount = total - activeCount

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 'var(--style-radius-m, 8px)',
        padding: '1.5rem',
        marginBottom: '2rem',
        background: 'var(--theme-elevation-0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <h3 style={{margin: 0}}>Tenants</h3>

        <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
          <Stat label="Total" value={total}/>
          <Stat label="Activos" value={activeCount} accent="var(--theme-success-500)"/>
          <Stat label="Inactivos" value={inactiveCount} accent="var(--theme-elevation-400)"/>
        </div>
      </div>

      {total === 0 ? (
        <p style={{color: 'var(--theme-elevation-400)', margin: 0}}>Aún no hay tenants.</p>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
          <tr>
            <th style={thStyle}>Nombre</th>
            <th style={thStyle}>Subdominio</th>
            <th style={thStyle}>Estado</th>
          </tr>
          </thead>
          <tbody>
          {all.docs.map((tenant) => (
            <tr key={tenant.id} style={trStyle}>
              <td style={tdStyle}>
                <Link href={`/admin/collections/tenants/${tenant.id}`} style={{textDecoration: 'none'}}>
                  {tenant.name || '(sin nombre)'}
                </Link>
              </td>
              <td style={tdStyle}>
                {tenant.subdomain ?
                  <a href={`https://${tenant.subdomain}.notoriovs.com`} target={'_blank'} style={{textDecoration: 'none'}}>
                    {tenant.subdomain}.notoriovs.com <ArrowOutward/>
                  </a>
                  : '—'
                }
              </td>
              <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: tenant.active ? 'var(--theme-success-800)' : 'var(--theme-elevation-600)',
                      background: tenant.active ? 'var(--theme-success-100)' : 'var(--theme-elevation-100)',
                    }}
                  >
                    {tenant.active ? 'Activo' : 'Inactivo'}
                  </span>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const Stat: React.FC<{ label: string; value: number; accent?: string }> = ({
                                                                             label,
                                                                             value,
                                                                             accent,
                                                                           }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: '4.5rem',
      padding: '0.4rem 0.75rem',
      borderRadius: '6px',
      background: 'var(--theme-elevation-50)',
    }}
  >
    <span style={{fontSize: '1.25rem', fontWeight: 700, color: accent || 'inherit'}}>
      {value}
    </span>
    <span style={{fontSize: '0.7rem', color: 'var(--theme-elevation-500)'}}>{label}</span>
  </div>
)

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.5rem',
  fontSize: '0.75rem',
  color: 'var(--theme-elevation-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
}

const trStyle: React.CSSProperties = {
  borderTop: '1px solid var(--theme-elevation-100)',
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.5rem',
  fontSize: '1rem',
}

export default TenantsDashboardWidget
