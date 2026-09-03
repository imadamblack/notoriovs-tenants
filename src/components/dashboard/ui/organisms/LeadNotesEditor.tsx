import Textarea from '@/components/dashboard/ui/atoms/Textarea'

type LeadNotesEditorProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  saving?: boolean
  saved?: boolean
  showStatus?: boolean
  rows?: number
}

export default function LeadNotesEditor({
  label,
  value,
  onChange,
  onBlur,
  saving = false,
  saved = false,
  showStatus = false,
  rows = 10,
}: LeadNotesEditorProps) {
  return (
    <div className="flex flex-col gap-1 -ft-3 text-neutral-200">
      {label && <span>{label}</span>}
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} rows={rows} />
      {showStatus && (
        <span className="-ft-4 text-neutral-400 h-4">{saving ? 'Guardando…' : saved ? 'Guardado ✓' : ''}</span>
      )}
    </div>
  )
}
