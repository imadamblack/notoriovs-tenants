import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="relative mb-0  border-t">
      <div className="bg-black py-6">
        <div className="container flex flex-col md:flex-row items-start justify-start gap-8 text-white py-8 sans">
          <div className="flex flex-col md:flex-row gap-2">
            <p className="-ft-1 text-neutral-50">Todos los derechos reservados.</p>
            <div className="flex gap-2 mr-3">
              <span
                 className="relative w-[10rem] ">
                <Image src="/logo-outline.svg" fill className="invert" alt="Another Real Estate Agency"/>
              </span>
              <svg
                className="relative w-[1em] h-[1em] text-neutral-50 !my-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
              <a href="https://marketing.notoriovs.com"
                 target="_blank"
                 className="relative w-[13rem]">
                <Image src="/notoriovs.png" fill className="invert" alt="Notoriovs Studio"/>
              </a>
            </div>
            <p className="-ft-1 text-neutral-50">©{" "}{new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
