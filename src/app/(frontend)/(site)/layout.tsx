import Header from '@/components/header';
import Footer from '@/components/footer';
import TrackingAnalytics from '@/components/trackingAnalytics';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Another Real Estate Agency',
  description:
    'Agencia boutique de inversión inmobiliaria en preventa',
}

// Layout anidado dentro de (frontend)/layout.tsx, que ya define <html>/<body>.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TrackingAnalytics/>
      <Header/>
      <main>{children}</main>
      <Footer/>
    </>
  )
}
