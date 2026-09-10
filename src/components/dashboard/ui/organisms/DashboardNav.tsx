import {useEffect, useRef, useState} from 'react'
import Button from '@/components/dashboard/ui/atoms/Button'
import type {DashboardTab} from '@/components/dashboard/DashboardApp'
import AdminLogo from '@/components/AdminLogo';
import IconPaid from "@/components/dashboard/ui/atoms/icons/IconPaid";
import IconMonitoring from "@/components/dashboard/ui/atoms/icons/IconMonitoring";
import IconAccount from "@/components/dashboard/ui/atoms/icons/IconAccount";
import IconLogout from "@/components/dashboard/ui/atoms/icons/IconLogout";
import IconPlus from "@/components/dashboard/ui/atoms/icons/IconPlus";

type DashboardNavProps = {
  companyName?: string | null
  /** Email del Tenant User con el que está firmada la sesión. */
  accountEmail: string
  tab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  onLogout: () => void
  /**
   * Abre la administración del equipo, o `undefined` si esta sesión no tiene
   * el permiso `users:manage` (un `member`). Sin la función no se pinta la
   * entrada: un botón que siempre responde "no puedes" es peor que no
   * tenerlo — el mismo criterio que el borrado de leads.
   */
  onManageUsers?: () => void
}

// El logout dejó de ser un botón suelto que cerraba la sesión de un clic: ahí
// competía con las pestañas y se picaba sin querer. En su lugar va un menú de
// cuenta que muestra primero el email de quien está dentro —que es lo que hace
// útil el menú: con dos poblaciones de usuarios y una sesión que dura 30 días,
// "¿con qué cuenta estoy viendo esto?" es una pregunta real— y de ahí cuelga
// "Cerrar sesión".
export default function DashboardNav({companyName, accountEmail, tab, onTabChange, onLogout, onManageUsers}: DashboardNavProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

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

        <div className="relative ml-2" ref={accountRef}>
          <Button
            variant={menuOpen ? 'glass' : 'ghost'}
            size="sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Menú de cuenta"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <IconAccount />
          </Button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 z-50 min-w-[16rem] rounded-xl border border-neutral-600 bg-neutral-800 p-2 shadow-xl"
            >
              <p className="px-3 py-2 -ft-4 text-neutral-400 break-all text-left">
                {accountEmail}
              </p>
              {onManageUsers && (
                <Button
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                  className="w-full !rounded-lg flex items-center gap-2 !justify-start text-left"
                  onClick={() => {
                    setMenuOpen(false)
                    onManageUsers()
                  }}
                >
                  <span className="w-4 h-4 inline-flex items-center">
                    <IconPlus />
                  </span>
                  Usuarios
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                role="menuitem"
                className="w-full !rounded-lg flex items-center gap-2 !justify-start text-left"
                onClick={() => {
                  setMenuOpen(false)
                  onLogout()
                }}
              >
                <span className="w-4 h-4 inline-flex items-center">
                  <IconLogout />
                </span>
                Cerrar sesión
              </Button>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
