import Button from '@/components/dashboard/ui/atoms/Button'
import type {DashboardTab} from '@/components/dashboard/DashboardApp'
import AdminLogo from '@/components/AdminLogo';
import IconPaid from "@/components/dashboard/ui/atoms/icons/IconPaid";
import IconMonitoring from "@/components/dashboard/ui/atoms/icons/IconMonitoring";

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
        {/* El logo ES el botón de salir: era el único elemento del nav sin
            función y el icono de logout ocupaba un lugar en la barra de
            navegación que no le tocaba. */}
        <button
          type="button"
          onClick={onLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="w-8 h-8 p-0 bg-transparent flex items-center"
        >
          <AdminLogo color="--dashboard-color-text"/>
        </button>
        <h1 className="ft-1 font-bold text-neutral-200">{companyName}</h1>
      </div>
      <nav className="flex items-center gap-2">
        <Button
          variant={tab === 'kanban' ? 'glass' : 'ghost'}
          className={tab === 'kanban' ? '!text-brand-5' : ''}
          size="md"
          onClick={() => onTabChange('kanban')}
        >
          <IconPaid />
        </Button>
        <Button
          variant={tab === 'kpis' ? 'glass' : 'ghost'}
          size="md"
          className={tab === 'kpis' ? '!text-brand-5' : ''}
          onClick={() => onTabChange('kpis')}
        >
          <IconMonitoring />
        </Button>
      </nav>
    </header>
  )
}
