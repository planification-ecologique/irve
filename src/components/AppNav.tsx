import { ANALYTICS_PATH, MAP_PATH, TARIFFS_PATH, type AppPage } from '../lib/routes'

interface AppNavProps {
  active: AppPage
}

const LINKS: { page: AppPage; href: string; label: string }[] = [
  { page: 'map', href: MAP_PATH, label: 'Carte' },
  { page: 'analytics', href: ANALYTICS_PATH, label: 'Analyse' },
  { page: 'tariffs', href: TARIFFS_PATH, label: 'Tarifs' },
]

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="Navigation principale">
      {LINKS.map(({ page, href, label }) => (
        <a
          key={page}
          href={href}
          className={`app-nav__link${active === page ? ' app-nav__link--active' : ''}`}
          aria-current={active === page ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
