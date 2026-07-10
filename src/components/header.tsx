'use client';
import Link from 'next/link';
import Image from 'next/image';

const ArrowIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
    <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

export default function Header() {
  return (
    <header className="px-8 w-full h-[4rem] md:h-[6rem] flex justify-between items-center bg-neutral-100/50 backdrop-blur-md sticky top-0 z-50 shadow-md">
      <div className="relative w-[12rem] md:w-[20rem] aspect-[4/1] flex justify-start items-center gap-7 overflow-hidden">
        <Link href="/">
          <Image
            src="/logo.svg"
            fill
            alt="Another Real Estate Agency"
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>
      </div>

      <div className="hidden md:flex gap-10">
        {['Criterios', 'Proceso', 'FAQ'].map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
            className="text-[12px] font-medium tracking-[0.12em] uppercase text-[#1a1814] no-underline hover:text-[#8a8680] transition-colors"
          >
            {label}
          </a>
        ))}
      </div>

      <a
        href="#contact"
        className="text-[11px] font-medium tracking-[0.1em] uppercase text-[#1a1814] no-underline border-b border-[#1a1814] pb-[2px] flex items-center gap-1.5 hover:text-[#8a8680] hover:border-[#8a8680] transition-colors"
      >
        Agenda
        <ArrowIcon />
      </a>
    </header>
  )

}
