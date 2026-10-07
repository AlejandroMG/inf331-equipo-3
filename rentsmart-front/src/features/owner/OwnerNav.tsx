import { NavLink } from 'react-router'
import { cn } from '../../lib/cn'
import { paths } from '../../lib/paths'

const links = [
  { to: paths.ownerSpaces, label: 'Mis espacios' },
  { to: paths.ownerBookings, label: 'Reservas' },
  { to: paths.ownerMetrics, label: 'Métricas' },
]

/** Las tres pantallas del panel del propietario; la actual queda marcada con `aria-current="page"`. */
export function OwnerNav() {
  return (
    <nav aria-label="Panel del propietario" className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold no-underline',
              isActive ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink hover:bg-surface',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
