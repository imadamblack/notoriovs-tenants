import SectionHeading from '@/components/dashboard/ui/atoms/SectionHeading'
import ProgressBar from '@/components/dashboard/ui/atoms/ProgressBar'
import type { StageKpi } from '@/components/dashboard/KpiReport'

type KpiStageProgressSectionProps = {
  byStage: StageKpi[]
  hasPipeline: boolean
  otherCount: number
}

export default function KpiStageProgressSection({ byStage, hasPipeline, otherCount }: KpiStageProgressSectionProps) {
  return (
    <section>
      <SectionHeading>Progreso por etapa</SectionHeading>
      <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col gap-3">
        {byStage.map((stage) => (
          <div key={stage.id} className="flex items-center gap-3">
            <span className="w-32 text-sm text-neutral-600 truncate">{stage.label}</span>
            <ProgressBar value={stage.pct} />
            <span className="w-16 text-right text-sm text-neutral-500">
              {stage.count} ({stage.pct}%)
            </span>
          </div>
        ))}
        {!hasPipeline && <p className="text-sm text-neutral-400">Sin pipeline configurado.</p>}
        {otherCount > 0 && (
          <p className="text-xs text-neutral-400">
            {otherCount} lead(s) con una etapa que ya no existe en el pipeline actual.
          </p>
        )}
      </div>
    </section>
  )
}
