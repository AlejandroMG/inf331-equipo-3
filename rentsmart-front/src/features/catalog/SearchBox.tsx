import { useId, useState } from 'react'
import { Button } from '../../components/Button'
import { SearchIcon } from '../../components/icons'
import { MAX_SEARCH_LENGTH } from './filters'

interface SearchBoxProps {
  /** El texto de la búsqueda vigente (el de la URL). */
  value: string
  /** Se llama al enviar, con el texto sin espacios de los bordes; vacío quita la búsqueda. */
  onSearch: (text: string) => void
}

/**
 * Buscador por texto libre. Se aplica al enviar (Enter o "Buscar"), no en cada tecla, para no pedir
 * resultados a medias. Quien lo usa le pone `key={value}` para que se actualice si la URL cambia.
 */
export function SearchBox({ value, onSearch }: SearchBoxProps) {
  const [text, setText] = useState(value)
  const inputId = useId()

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(text.trim())
      }}
      className="flex max-w-[860px] flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
    >
      <div className="flex min-w-[240px] flex-1 items-center gap-2.5 px-3 text-muted">
        <SearchIcon />
        <label htmlFor={inputId} className="sr-only">
          Buscar espacios
        </label>
        <input
          id={inputId}
          type="search"
          value={text}
          maxLength={MAX_SEARCH_LENGTH}
          onChange={(event) => setText(event.target.value)}
          placeholder="Busca por nombre, tipo o comuna"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-ink"
        />
      </div>
      <Button type="submit" className="w-full sm:w-auto">
        Buscar
      </Button>
    </form>
  )
}
