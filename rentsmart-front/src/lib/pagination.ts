export type PageItem = number | 'gap'

/** Números de página a mostrar: siempre la primera, la última y las vecinas de la actual. */
export function pageItems(page: number, totalPages: number): PageItem[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1])
  const numbers = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const items: PageItem[] = []
  numbers.forEach((n, i) => {
    if (i > 0 && n - numbers[i - 1] > 1) items.push('gap')
    items.push(n)
  })
  return items
}
