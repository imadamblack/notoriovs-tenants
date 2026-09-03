import CenteredScreenCard from '@/components/dashboard/ui/molecules/CenteredScreenCard'

export default function DashboardUnavailable() {
  return (
    <CenteredScreenCard maxWidth="md">
      <div className="text-center">
        <h1 className="ft-3 font-bold text-neutral-100 mb-2">Dashboard no disponible</h1>
        <p className="text-neutral-400">
          Este tenant todavía no tiene un dashboard configurado. Contacta a Notoriovs para activarlo.
        </p>
      </div>
    </CenteredScreenCard>
  )
}
