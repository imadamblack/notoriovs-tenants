import { Fragment } from 'react'
import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import ProgressBar from '@/components/dashboard/ui/atoms/ProgressBar'
import type { StageKpi } from '@/components/dashboard/KpiReport'

type KpiStageProgressSectionProps = {
  byStage: StageKpi[]
  hasPipeline: boolean
  otherCount: number
}

const LABEL_WIDTH = 'w-32'
const LABEL_OFFSET = 'ml-32'

export default function KpiStageProgressSection({ byStage, hasPipeline, otherCount }: KpiStageProgressSectionProps) {
  return (
    <section className="flex-col">
      <SectionHeading>Progreso por etapa</SectionHeading>
      <p className="-ft-3 text-neutral-400 -mt-2 mb-3">
        Cada etapa cuenta los leads que llegaron al menos hasta ahí. El porcentaje entre renglones es la conversión
        de una etapa a la siguiente.
      </p>
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 flex flex-col gap-2">
        {byStage.map((stage, i) => (
          <Fragment key={stage.id}>
            {stage.stepPct !== null && (
              <p className={`-ft-4 text-neutral-400 flex justify-between tabular-nums truncate ${LABEL_OFFSET} pl-3`}>
                ↓ {stage.stepPct}% de {byStage[i - 1].label}
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className={`${LABEL_WIDTH} -ft-1 text-neutral-300 truncate`}>{stage.label}</span>
              <ProgressBar value={stage.pct} />
              <span className="w-20 mono text-right -ft-1 text-neutral-400 whitespace-nowrap">
                {stage.count}
              </span>
            </div>
          </Fragment>
        ))}
        {!hasPipeline && <p className="-ft-1 text-neutral-400">Sin pipeline configurado.</p>}
        {otherCount > 0 && (
          <p className="-ft-3 text-neutral-400 mt-1">
            {otherCount} lead(s) con una etapa que ya no existe en el pipeline actual.
          </p>
        )}
      </div>
    </section>
  )
}
