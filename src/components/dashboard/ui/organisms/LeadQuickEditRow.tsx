'use client'

import type { ChangeEvent } from 'react'
import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'
import Select from '@/components/dashboard/ui/atoms/Select'
import PipelineProgress from '@/components/dashboard/ui/molecules/PipelineProgress'
import { statusLabel } from '@/components/dashboard/leadPresentation'

const STATUS_VALUES: Lead['status'][] = ['open', 'won', 'lost', 'disqualified']

type LeadQuickEditRowProps = {
  pipeline: PipelineStage[]
  stage: string
  status: Lead['status']
  onStageChange: (stage: string) => void
  onStatusChange: (status: Lead['status']) => void
}

export default function LeadQuickEditRow({
  pipeline,
  stage,
  status,
  onStageChange,
  onStatusChange,
}: LeadQuickEditRowProps) {
  const currentStageIndex = pipeline.findIndex((s) => s.id === stage)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4">
        <Select
          value={stage}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onStageChange(e.target.value)}
          aria-label="Cambiar etapa"
          className="flex-grow bg-neutral-800 text-neutral-200 border-0 h-16 px-4 -ft-1 font-medium truncate cursor-pointer"
        >
          {pipeline.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>

        <div className="relative shrink-0 w-16 h-16">
          <Select
            value={status}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onStatusChange(e.target.value as Lead['status'])}
            title="Cambiar status"
            aria-label="Cambiar status"
            className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </Select>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-neutral-800 text-neutral-200 rounded-lg flex items-center justify-center -ft-1"
          >
            ⋮
          </div>
        </div>
      </div>

      <PipelineProgress steps={pipeline.length} currentIndex={currentStageIndex} />
    </div>
  )
}
