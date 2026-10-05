import { Link } from 'react-router'
import { paths } from '../lib/paths'

const footerLink = 'text-[15px] text-white underline-offset-2 hover:underline'
const columnTitle = 'text-[13px] font-bold uppercase tracking-wider opacity-80'

export function Footer() {
  return (
    <footer className="bg-primary-dark px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-x-16 gap-y-8">
        <div className="max-w-sm flex-1 basis-72">
          <div className="font-display text-[22px] font-bold">RentSmart</div>
          <p className="mt-2 text-[15px] leading-normal">
            Arrienda espacios entre particulares, por hora o por día, y paga en línea.
          </p>
        </div>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-14 gap-y-8">
          <div className="flex flex-col gap-2.5">
            <span className={columnTitle}>Arrendar</span>
            <Link to={paths.home} className={footerLink}>
              Explorar espacios
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className={columnTitle}>Publicar</span>
            <Link to={paths.publish} className={footerLink}>
              Publicar un espacio
            </Link>
            <Link to={paths.ownerSpaces} className={footerLink}>
              Mis espacios
            </Link>
          </div>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-[1200px] border-t border-white/25 pt-5 text-[13px]">INF331 · Equipo 3</p>
    </footer>
  )
}
