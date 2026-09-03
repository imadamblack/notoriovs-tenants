import IconChevronLeft from '@/components/dashboard/ui/atoms/icons/IconChevronLeft'
import IconEdit from '@/components/dashboard/ui/atoms/icons/IconEdit'
import Badge, { type BadgeTone } from '@/components/dashboard/ui/atoms/Badge'

type LeadDetailHeaderProps = {
  name: string
  badge: { label: string; tone: BadgeTone } | null
  mode: 'read' | 'write'
  onBack: () => void
  onEdit: () => void
}

export default function LeadDetailHeader({ name, badge, mode, onBack, onEdit }: LeadDetailHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="mr-6 bg-transparent text-neutral-400 hover:text-brand-2 p-0 w-auto"
          >
            <IconChevronLeft />
          </button>
        </div>
        {mode === 'read' && (
          <button
            type="button"
            onClick={onEdit}
            title="Editar lead"
            aria-label="Editar lead"
            className="bg-transparent text-neutral-300 w-11 h-11 p-0 flex items-center justify-center shrink-0 ml-4"
          >
            <IconEdit />
          </button>
        )}
      </div>
      {mode === 'read' && (
        <div className="flex gap-4">
          <h2 className="flex flex-grow ft-2 font-bold text-neutral-200 truncate">{name}</h2>
          {badge && <Badge label={badge.label} tone={badge.tone} size="lg" />}
        </div>
      )}
    </>
  )
}
