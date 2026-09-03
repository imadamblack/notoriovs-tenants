import '@/styles/dashboard/dashboard.scss'
import type { ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="dashboard-root">{children}</div>
}
