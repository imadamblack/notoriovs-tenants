// Tres pesos visuales, no tres estilos por gusto: dentro de una sección hay
// un número que la resume ("Leads totales", "Gasto total") y otros que solo
// dan contexto ("Impresiones"). Con todos del mismo tamaño el ojo no sabe
// dónde aterrizar, que era justo el problema de la pestaña de KPIs.
export type StatTileEmphasis = 'primary' | 'default' | 'support'

type StatTileProps = {
  label: string
  value: string
  sub?: string
  emphasis?: StatTileEmphasis
}

const VALUE_CLASSES: Record<StatTileEmphasis, string> = {
  primary: 'ft-6 text-neutral-50',
  default: 'ft-4 text-neutral-200',
  support: 'ft-3 text-neutral-400',
}

const CARD_CLASSES: Record<StatTileEmphasis, string> = {
  primary: 'border-brand-3/50',
  default: 'border-neutral-800',
  support: 'border-neutral-800/50',
}

export default function StatTile({ label, value, sub, emphasis = 'default' }: StatTileProps) {
  return (
    <div className={`bg-neutral-900 rounded-xl border p-4 flex-1 min-w-[160px] ${CARD_CLASSES[emphasis]}`}>
      <p className="-ft-2 tracking-wide text-neutral-400">{label}</p>
      <p className={`font-bold mt-1 tabular-nums ${VALUE_CLASSES[emphasis]}`}>{value}</p>
      {sub && <p className="-ft-4 text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}
