'use client'

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, toast } from '@payloadcms/ui'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'

// Alta en bloque de Leads: subir un CSV en vez de abrir el formulario uno por
// uno. Se registra en Leads.admin.components.beforeListTable (payload.config.ts
// vive por colección, así que esto se declara en src/collections/Leads.ts).
//
// Solo archivo, sin textarea para pegar: un textarea invita a escribir o
// pegar el CSV a mano y ahí es donde se rompen el delimitador, las comillas o
// el encabezado — errores que un archivo generado por Excel/Sheets (o por el
// propio botón de descarga de abajo) no comete. Restringir la entrada a un
// archivo real es lo que evita esa categoría de error, no una validación más.
//
// El tenant es el mismo que ya está seleccionado arriba en el panel
// (`useTenantSelection`, el selector que agrega multiTenantPlugin): no hay un
// segundo selector aquí, para que "a qué cliente le estoy dando de alta esto"
// sea una sola pregunta en toda la pantalla. Si no hay tenant seleccionado, el
// panel ya está mostrando "Selecciona un Tenant" en vez de la lista, así que
// este bloque simplemente no se muestra.
//
// El parseo (delimitador, encabezado, columnas de respuestas del quiz) vive
// del lado del servidor (/api/leads/bulk-import): aquí solo se manda el texto
// tal como se leyó del archivo, y se pinta el resultado fila por fila. La
// plantilla ("Descargar CSV de ejemplo") la arma ese mismo endpoint con las
// preguntas ACTUALES del quiz de este tenant — si el quiz cambia, la
// plantilla cambia sola, sin que alguien tenga que actualizar un archivo de
// ejemplo a mano en algún lado.
type RowResult = {
  line: number
  op: 'created' | 'skipped'
  id?: string | number
  error?: string
  duplicateOf?: string | number
}

export const BulkLeadImport: React.FC = () => {
  const { selectedTenantID, options } = useTenantSelection()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingSchema, setDownloadingSchema] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  if (!selectedTenantID) return null

  // `option.label` es `OptionLabel` (payload/dist/fields/config/types), que
  // admite JSX o labels por locale además de texto plano. El selector de
  // tenant del plugin siempre lo llena con el `name` del Tenant (un string),
  // pero el tipo no lo garantiza — de ahí el filtro antes de meterlo en JSX.
  const tenantLabelRaw = options.find((option) => option.value === selectedTenantID)?.label
  const tenantLabel = typeof tenantLabelRaw === 'string' ? tenantLabelRaw : undefined

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setText(typeof reader.result === 'string' ? reader.result : '')
      setResults(null)
    }
    reader.onerror = () => toast.error('No se pudo leer el archivo')
    reader.readAsText(file, 'utf-8')
  }

  const downloadCsv = async (url: string, fallbackName: string, errorMessage: string) => {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        toast.error(json?.error || errorMessage)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filenameMatch?.[1] || fallbackName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      toast.error('No se pudo conectar con el servidor')
    }
  }

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      await downloadCsv(
        `/api/leads/bulk-import?tenant=${selectedTenantID}`,
        'leads-plantilla.csv',
        'No se pudo generar la plantilla',
      )
    } finally {
      setDownloading(false)
    }
  }

  // El schema no reemplaza la plantilla: la plantilla trae el encabezado
  // listo para llenar, esto trae el mapa clave↔etiqueta de Etapa, Resultado,
  // Origen y cada opción del quiz, para quien está acomodando un CSV que ya
  // trae sus propios valores y necesita saber a cuál de los de este tenant
  // corresponde cada uno.
  const handleDownloadSchema = async () => {
    setDownloadingSchema(true)
    try {
      await downloadCsv(
        `/api/leads/bulk-import?tenant=${selectedTenantID}&format=schema`,
        'leads-schema.csv',
        'No se pudo generar el schema',
      )
    } finally {
      setDownloadingSchema(false)
    }
  }

  const handleImport = async () => {
    if (!text.trim()) return

    setSubmitting(true)
    setResults(null)
    try {
      const res = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: selectedTenantID, text }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json?.error || 'No se pudo importar')
        return
      }

      const rows: RowResult[] = json.results || []
      setResults(rows)
      const created = rows.filter((row) => row.op === 'created').length
      const skipped = rows.length - created
      const duplicates = rows.filter((row) => row.op === 'created' && row.duplicateOf).length

      if (created > 0) {
        const parts = [`${created} lead${created === 1 ? '' : 's'} importado${created === 1 ? '' : 's'}`]
        if (duplicates > 0) parts.push(`${duplicates} posible${duplicates === 1 ? '' : 's'} duplicado${duplicates === 1 ? '' : 's'}`)
        if (skipped > 0) parts.push(`${skipped} omitido${skipped === 1 ? '' : 's'}`)
        toast.success(parts.join(', '))
        setText('')
        setFileName(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        router.refresh()
      } else {
        toast.error('No se importó ningún lead. Revisa los errores abajo.')
      }
    } catch {
      toast.error('No se pudo conectar con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 'var(--style-radius-m, 8px)',
        padding: '1rem',
        marginBottom: '1.5rem',
        background: 'var(--theme-elevation-0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          cursor: 'pointer',
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <strong>Importar Leads en bloque{tenantLabel ? ` — ${tenantLabel}` : ''}</strong>
        <Button buttonStyle="secondary" size="small">
          {open ? 'Ocultar' : 'Abrir'}
        </Button>
      </div>

      {open && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>
            Descarga el CSV de ejemplo, llénalo y súbelo de vuelta: trae ya el encabezado exacto
            (Nombre, Teléfono, WhatsApp, Correo, Notas, Etapa, Resultado, Origen, Fecha de alta,
            las columnas UTM y una por cada pregunta del quiz de{' '}
            <strong>{tenantLabel || 'este tenant'}</strong>).
            Etapa/Resultado/Origen y las opciones del quiz aceptan su nombre
            (&quot;Contactado&quot;, &quot;Ganado&quot;, &quot;Meta Ads&quot;…) o su clave interna; las
            que dejes vacías o sin columna caen en la primera etapa del pipeline,
            &quot;Abierto&quot; e &quot;Importado&quot;. &quot;Fecha de alta&quot; es opcional
            (&quot;DD/MM/AAAA&quot; o &quot;DD/MM/AAAA HH:mm&quot;) — vacía, el lead nace hoy; para
            migrar leads históricos, escribe la fecha real. Si ya tienes un CSV propio con sus
            propias claves, descarga el schema para saber a cuál de las de este tenant
            corresponde cada una.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <Button buttonStyle="secondary" size="small" onClick={handleDownloadTemplate} disabled={downloading}>
              {downloading ? 'Generando…' : 'Descargar CSV de ejemplo'}
            </Button>

            <Button
              buttonStyle="secondary"
              size="small"
              onClick={handleDownloadSchema}
              disabled={downloadingSchema}
            >
              {downloadingSchema ? 'Generando…' : 'Descargar schema (clave/etiqueta)'}
            </Button>

            <Button buttonStyle="secondary" size="small" onClick={() => fileInputRef.current?.click()}>
              Subir CSV{fileName ? `: ${fileName}` : ''}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
            <Button onClick={handleImport} disabled={submitting || !text.trim()}>
              {submitting ? 'Importando…' : 'Importar'}
            </Button>
          </div>

          {results && (
            <ul style={{ marginTop: '1rem', fontSize: '0.85rem', paddingLeft: '1.25rem' }}>
              {results.map((row) => (
                <li
                  key={row.line}
                  style={{
                    color:
                      row.op !== 'created'
                        ? 'var(--theme-error-500)'
                        : row.duplicateOf
                          ? 'var(--theme-warning-500)'
                          : 'var(--theme-success-600)',
                  }}
                >
                  Línea {row.line}:{' '}
                  {row.op === 'created'
                    ? row.duplicateOf
                      ? `importado — mismo teléfono/WhatsApp que el lead #${row.duplicateOf}, revisa si es duplicado`
                      : 'importado'
                    : `omitido — ${row.error}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default BulkLeadImport
