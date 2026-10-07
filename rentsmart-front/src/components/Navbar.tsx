import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { cn } from '../lib/cn'
import { paths } from '../lib/paths'
import { useCurrentUser } from '../features/auth/useCurrentUser'
import { clearToken, useToken } from '../lib/token'
import { Button, LinkButton } from './Button'
import { CloseIcon, MenuIcon } from './icons'

interface NavItem {
  to: string
  label: string
  end: boolean
}

/** Menú según la sesión (CU-03): "Mis espacios" y "Favoritos" con sesión, y "Administración" solo para ADMIN. */
function linksFor(loggedIn: boolean, isAdmin: boolean): NavItem[] {
  return [
    { to: paths.home, label: 'Explorar', end: true },
    ...(loggedIn
      ? [
          { to: paths.ownerSpaces, label: 'Mis espacios', end: false },
          { to: paths.favorites, label: 'Favoritos', end: false },
        ]
      : []),
    ...(isAdmin ? [{ to: paths.admin, label: 'Administración', end: false }] : []),
  ]
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex min-h-11 items-center rounded-control px-3.5 text-[15px] font-semibold no-underline',
    isActive ? 'bg-primary-soft text-primary-dark' : 'text-ink hover:bg-surface',
  )
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="10" fill="var(--color-primary)" />
      <path
        d="M9 16.5 17 10l8 6.5V25a1 1 0 0 1-1 1h-4v-6h-6v6h-4a1 1 0 0 1-1-1v-8.5Z"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const navigate = useNavigate()
  const loggedIn = useToken() !== null
  const { user } = useCurrentUser()
  const links = linksFor(loggedIn, user?.role === 'ADMIN')

  const logout = () => {
    closeMenu()
    clearToken()
    navigate(paths.home)
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-[72px] max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link to={paths.home} onClick={closeMenu} aria-label="RentSmart, ir al inicio" className="inline-flex min-h-11 items-center gap-2.5 text-ink no-underline">
          <Logo />
          <span className="font-display text-[22px] font-bold">RentSmart</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <LinkButton to={paths.publish} variant="outline" size="sm" className="ml-2">
            Publicar tu espacio
          </LinkButton>
          {loggedIn ? (
            <Button onClick={logout} variant="secondary" size="sm" className="ml-1">
              Salir
            </Button>
          ) : (
            <>
              <LinkButton to={paths.login} variant="secondary" size="sm" className="ml-1">
                Ingresar
              </LinkButton>
              <LinkButton to={paths.register} variant="primary" size="sm" className="ml-1">
                Crear cuenta
              </LinkButton>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="menu-movil"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="inline-flex size-11 items-center justify-center rounded-control border border-line bg-white md:hidden"
        >
          {menuOpen ? <CloseIcon width={22} height={22} /> : <MenuIcon width={22} height={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav id="menu-movil" aria-label="Principal" className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <LinkButton to={paths.publish} onClick={closeMenu} variant="outline" size="sm" className="mt-2">
            Publicar tu espacio
          </LinkButton>
          {loggedIn ? (
            <Button onClick={logout} variant="secondary" size="sm">
              Salir
            </Button>
          ) : (
            <>
              <LinkButton to={paths.login} onClick={closeMenu} variant="secondary" size="sm">
                Ingresar
              </LinkButton>
              <LinkButton to={paths.register} onClick={closeMenu} variant="primary" size="sm">
                Crear cuenta
              </LinkButton>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
