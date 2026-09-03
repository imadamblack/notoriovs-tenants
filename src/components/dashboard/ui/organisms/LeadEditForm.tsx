import type { ChangeEvent } from 'react'
import type { Lead, PipelineStage } from '@/components/dashboard/DashboardApp'
import Input from '@/components/dashboard/ui/atoms/Input'
import Select from '@/components/dashboard/ui/atoms/Select'
import { statusLabel } from '@/components/dashboard/leadPresentation'

const STATUS_VALUES: Lead['status'][] = ['open', 'won', 'lost', 'disqualified']

export type LeadEditFormValues = {
  name: string
  stage: string
  status: Lead['status']
  phone: string
  whatsapp: string
  email: string
}

type LeadEditFormProps = {
  values: LeadEditFormValues
  pipeline: PipelineStage[]
  onChange: (patch: Partial<LeadEditFormValues>) => void
  onStageChange: (stage: string) => void
}

export default function LeadEditForm({ values, pipeline, onChange, onStageChange }: LeadEditFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input label="Nombre" value={values.name} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })} />

      <Select label="Etapa" value={values.stage} onChange={(e: ChangeEvent<HTMLSelectElement>) => onStageChange(e.target.value)}>
        {pipeline.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.label}
          </option>
        ))}
      </Select>

      <Select
        label="Resultado"
        value={values.status}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ status: e.target.value as Lead['status'] })}
      >
        {STATUS_VALUES.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </Select>

      <Input label="Teléfono" value={values.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ phone: e.target.value })} />
      <Input label="WhatsApp" value={values.whatsapp} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ whatsapp: e.target.value })} />
      <Input label="Email" value={values.email} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ email: e.target.value })} />
    </div>
  )
}
