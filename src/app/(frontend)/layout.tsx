import '@/styles/globals.scss';
import Script from 'next/script';
import type { ReactNode } from 'react';

export async function generateMetadata() {
  return {
    title: 'Notoriovs Studio',
    description: 'Agencia de Marketing orientada a Resultados',
  };
}

export default function RootLayout({children}: { children: ReactNode }) {

  return (
    <html lang="es" className="scroll-pt-[6rem]">
    <head>
      <Script src="/typetura.js" strategy="beforeInteractive"/>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
      <link rel="icon" type="image/png" href="/favicon.png"/>
    </head>
    <body className="bg-neutral-100 text-[#1a1814] font-sans font-light leading-relaxed overflow-x-hidden">
    {children}
    </body>
    </html>
  );
}
