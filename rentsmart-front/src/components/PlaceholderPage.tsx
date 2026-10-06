import { Card } from './Card'

interface PlaceholderPageProps {
  title: string
  /** Historia que construye esta pantalla, por ejemplo "BU-01". */
  story: string
}

/** Pantalla provisoria de una ruta cuya historia todavía no se implementa. */
export function PlaceholderPage({ title, story }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      <Card className="mt-6 text-muted">Pantalla en construcción (historia {story}).</Card>
    </div>
  )
}
