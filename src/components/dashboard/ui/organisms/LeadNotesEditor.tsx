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
    <div className="flex flex-col gap-2">
      {label && <span className="-ft-2 font-semibold uppercase tracking-[0.08em] text-neutral-300">{label}</span>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        className="ft-0 text-neutral-100"
      />
      {showStatus && (
        <span className="-ft-4 text-neutral-400 h-4">{saving ? 'Guardando…' : saved ? 'Guardado ✓' : ''}</span>
      )}
    </div>
  )
}
