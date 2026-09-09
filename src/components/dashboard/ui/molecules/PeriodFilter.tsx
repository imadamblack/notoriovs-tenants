'use client'

import Select from '@/components/dashboard/ui/atoms/Select'
import IconClock from '@/components/dashboard/ui/atoms/icons/IconClock'
import { SINCE_LABELS, type SinceKey } from '@/utils/dashboardPeriod'

type PeriodFilterProps = {
  value: SinceKey
  onChange: (next: SinceKey) => void
  disabled?: boolean
  disabledTitle?: string
  id?: string
}

// Selector de periodo del dashboard. Es el mismo control en el toolbar de
// Leads y en la cabecera de KPIs (y el mismo estado detrás, ver
// DashboardApp): el periodo es una sola cosa para todo el dashboard, para
// que al cambiar de pestaña los números sigan hablando del mismo rango.
export default function PeriodFilter({
  value,
  onChange,
  disabled = false,
  disabledTitle,
  id = 'since-select',
}: PeriodFilterProps) {
  return (
    <div
      className={`relative h-12 w-12 rounded-full shrink-0 ${disabled ? 'opacity-40' : ''}`}
      title={disabled && disabledTitle ? disabledTitle : `Tiempo: ${SINCE_LABELS[value]}`}
    >
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as SinceKey)}
        aria-label="Filtrar por periodo"
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      >
        {Object.entries(SINCE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 isolate flex items-center justify-center rounded-full text-neutral-400 peer-hover:text-neutral-200"
      >
        <span className="w-8 h-8">
          <IconClock />
        </span>
      </div>
    </div>
  )
}
