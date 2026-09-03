import Button from '@/components/dashboard/ui/atoms/Button'
import type { DashboardTab } from '@/components/dashboard/DashboardApp'
import AdminLogo from '@/components/AdminLogo';

type DashboardNavProps = {
  companyName?: string | null
  tab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  onLogout: () => void
}

export default function DashboardNav({ companyName, tab, onTabChange, onLogout }: DashboardNavProps) {
  return (
    <header className="bg-neutral-800 border-b border-neutral-600 px-6 py-2 flex items-center justify-between">
      <div className="flex gap-4 items-center">
        <div className="w-8 h-8 flex items-center">
        <AdminLogo color="--dashboard-color-text"/>
        </div>
        <h1 className="ft-1 font-bold text-neutral-200">{companyName}</h1>
      </div>
      <nav className="flex items-center gap-2">
        <Button variant={tab === 'kanban' ? 'primary' : 'ghost'} size="sm" onClick={() => onTabChange('kanban')}>
          Leads
        </Button>
        <Button variant={tab === 'kpis' ? 'primary' : 'ghost'} size="sm" onClick={() => onTabChange('kpis')}>
          Reportes
        </Button>
        <Button variant="ghost" size="sm" className="ml-2" onClick={onLogout}>
          Salir
        </Button>
      </nav>
    </header>
  )
}
