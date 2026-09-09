import AdminLogo from '@/components/AdminLogo'
import IconCross from '@/components/dashboard/ui/atoms/icons/IconCross'

type BrandHeadingProps = {
  companyName?: string | null
}

// "{Cliente} × CRM" con el logo de Notoriovs. Lo comparten las tres pantallas
// que se ven SIN sesión —entrar, pedir recuperación y definir contraseña—
// para que un enlace que llega por correo se vea como el mismo producto del
// que salió, y no como una página de captura de contraseñas cualquiera.
export default function BrandHeading({ companyName }: BrandHeadingProps) {
  return (
    <div className="flex items-baseline relative">
      <h1 className="ft-4 font-bold text-neutral-100">{companyName}</h1>
      <span className="ft-4 inline-block w-[0.8em] h-[0.8em] mx-1 text-neutral-100">
        <IconCross />
      </span>
      <p className="ft-4 font-bold text-neutral-100">CRM</p>
      <div className="ml-2 w-12 h-12 self-center flex items-center">
        <AdminLogo color="--dashboard-color-text" />
      </div>
    </div>
  )
}
