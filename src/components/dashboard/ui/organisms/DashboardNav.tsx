import Button from '@/components/dashboard/ui/atoms/Button'
import type {DashboardTab} from '@/components/dashboard/DashboardApp'
import AdminLogo from '@/components/AdminLogo';
import IconPaid from "@/components/dashboard/ui/atoms/icons/IconPaid";
import IconMonitoring from "@/components/dashboard/ui/atoms/icons/IconMonitoring";
import IconLogout from "@/components/dashboard/ui/atoms/icons/IconLogout";

type DashboardNavProps = {
  companyName?: string | null
  tab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  onLogout: () => void
}

export default function DashboardNav({companyName, tab, onTabChange, onLogout}: DashboardNavProps) {
  return (
    <header className="bg-neutral-800 border-b border-neutral-600 px-6 py-3 flex items-center justify-between">
      <div className="flex gap-4 items-center">
        <div className="w-8 h-8 flex items-center">
          <AdminLogo color="--dashboard-color-text"/>
        </div>
        <h1 className="ft-1 font-bold text-neutral-200">{companyName}</h1>
      </div>
      <nav className="flex items-center gap-2">
        <Button
          variant={tab === 'kanban' ? 'glass' : 'ghost'}
          size="md"
          onClick={() => onTabChange('kanban')}
        >
          <IconPaid />
        </Button>
        <Button
          variant={tab === 'kpis' ? 'glass' : 'ghost'}
          size="md"
          onClick={() => onTabChange('kpis')}
        >
          <IconMonitoring />
        </Button>
        <Button variant="ghost" size="sm" className="ml-2" onClick={onLogout}>
          <IconLogout />
        </Button>
      </nav>
    </header>
  )
}
