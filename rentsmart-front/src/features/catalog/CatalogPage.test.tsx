import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { CatalogPage } from './CatalogPage'

function renderCatalog(path = '/') {
  const router = createMemoryRouter([{ path: '/', element: <CatalogPage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('CatalogPage', () => {
  it('muestra un estado de carga y luego los espacios con su total', async () => {
    renderCatalog()

    expect(screen.getByRole('status', { name: 'Cargando espacios' })).toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando espacios' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12)
    expect(screen.getByText('14 espacios')).toBeInTheDocument()
  })

  it('pagina: la página 2 muestra el resto y la URL lleva ?page', async () => {
    const router = renderCatalog()
    await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })

    await userEvent.click(screen.getByRole('link', { name: 'Página 2' }))

    expect(await screen.findByRole('heading', { level: 3, name: 'Taller de cerámica' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
    expect(screen.queryByRole('heading', { level: 3, name: 'Sala Alameda' })).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
  })

  it('abre directo en la página de la URL', async () => {
    renderCatalog('/?page=2')

    expect(await screen.findByRole('heading', { level: 3, name: 'Taller de cerámica' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  it.each(['/?page=abc', '/?page=0', '/?page=-3', '/?page=1.5'])('con %s vuelve a la página 1', async (path) => {
    renderCatalog(path)

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
  })

  it('cada tarjeta enlaza al detalle del espacio', async () => {
    renderCatalog()

    const card = (await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).closest('a')!

    expect(within(card).getByText('Santiago')).toBeInTheDocument()
    expect(card).toHaveAttribute('href', '/spaces/seed-space-1')
  })

  it('con un error muestra el mensaje y permite reintentar', async () => {
    let calls = 0
    server.use(
      mswHttp.get('*/api/catalog', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ message: 'Servicio caído' }, { status: 500 })
          : HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 12 })
      }),
    )
    renderCatalog()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar los espacios.')
    expect(alert).toHaveTextContent('Servicio caído')

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Todavía no hay espacios publicados')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin espacios muestra un mensaje y no la paginación', async () => {
    server.use(mswHttp.get('*/api/catalog', () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 12 })))
    renderCatalog()

    expect(await screen.findByText('Todavía no hay espacios publicados')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('presenta el catálogo bajo el buscador', async () => {
    renderCatalog()

    expect(screen.getByRole('heading', { level: 1, name: 'Encuentra el espacio justo, por hora o por día' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Espacios disponibles' })).toBeInTheDocument()
  })
})

describe('CatalogPage: filtros y búsqueda (BU-03)', () => {
  const names = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  const select = (name: string) => screen.getByRole('combobox', { name })

  /** Abre el catálogo y espera a que lleguen los espacios y las opciones de los filtros. */
  async function openCatalog(path = '/') {
    const router = renderCatalog(path)
    await screen.findByRole('button', { name: 'Taller' })
    await screen.findByText(/^\d+ espacios?$/)
    return router
  }

  /** Guarda las peticiones al catálogo, sin cambiar su respuesta. */
  function spyOnCatalog() {
    const urls: URL[] = []
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname === '/api/catalog') urls.push(url)
    })
    return urls
  }

  it('muestra el buscador, un chip por tipo y los selectores, sin filtros aplicados', async () => {
    await openCatalog()

    expect(screen.getByRole('searchbox', { name: 'Buscar espacios' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Tipo de espacio' })).getAllByRole('button')).toHaveLength(9) // Todos + 8 tipos
    expect(within(select('Comuna')).getAllByRole('option')).toHaveLength(6)
    expect(within(select('Capacidad mínima')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Cualquier capacidad',
      '4 o más personas',
      '8 o más personas',
      '15 o más personas',
      '40 o más personas',
    ])
    expect(screen.getByRole('button', { name: 'Por hora', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por día', pressed: false })).toBeInTheDocument()
    expect(within(select('Precio mínimo')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Precio mínimo',
      'Desde $5.000 / hora',
      'Desde $10.000 / hora',
      'Desde $15.000 / hora',
      'Desde $20.000 / hora',
      'Desde $30.000 / hora',
    ])
    expect(within(select('Precio máximo')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Precio máximo',
      'Hasta $5.000 / hora',
      'Hasta $10.000 / hora',
      'Hasta $15.000 / hora',
      'Hasta $20.000 / hora',
      'Hasta $30.000 / hora',
    ])
    expect(screen.getByText('14 espacios')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  describe('tipo', () => {
    it('al elegir un chip filtra, lo marca y lo deja en la URL', async () => {
      const router = await openCatalog()

      await userEvent.click(screen.getByRole('button', { name: 'Taller' }))

      expect(await screen.findByText('2 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Taller metálico San Miguel', 'Taller de cerámica'])
      expect(screen.getByRole('button', { name: 'Taller', pressed: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Todos', pressed: false })).toBeInTheDocument()
      expect(router.state.location.search).toBe('?typeId=8')
    })

    it('"Todos" quita el filtro de tipo', async () => {
      const router = await openCatalog('/?typeId=8')
      await screen.findByText('2 espacios')

      await userEvent.click(screen.getByRole('button', { name: 'Todos' }))

      expect(await screen.findByText('14 espacios')).toBeInTheDocument()
      expect(router.state.location.search).toBe('')
    })
  })

  describe('comuna, capacidad y precio', () => {
    it('filtra por comuna', async () => {
      const router = await openCatalog()

      await userEvent.selectOptions(select('Comuna'), 'Ñuñoa')

      expect(await screen.findByText('3 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Cowork Plaza Ñuñoa', 'Estudio de grabación Ñuñoa', 'Taller de cerámica'])
      expect(router.state.location.search).toBe('?communeId=3')
    })

    it('filtra por capacidad mínima', async () => {
      const router = await openCatalog()

      await userEvent.selectOptions(select('Capacidad mínima'), '15 o más personas')

      expect(await screen.findByText('3 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Salón Jardín', 'Sala Directorio Centro', 'Bodega de eventos Santiago'])
      expect(router.state.location.search).toBe('?minCapacity=15')
    })

    it('filtra por precio máximo por hora y deja fuera los que no se arriendan por hora', async () => {
      const router = await openCatalog()

      await userEvent.selectOptions(select('Precio máximo'), 'Hasta $10.000 / hora')

      expect(await screen.findByText('5 espacios')).toBeInTheDocument()
      expect(names()).not.toContain('Bodega de eventos Santiago') // solo se arrienda por día
      expect(names()).toContain('Taller metálico San Miguel') // $9.000 la hora
      expect(router.state.location.search).toBe('?maxPrice=10000')
    })

    it('filtra por precio mínimo por hora', async () => {
      const router = await openCatalog()

      await userEvent.selectOptions(select('Precio mínimo'), 'Desde $20.000 / hora')

      expect(await screen.findByText('3 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Cancha techada Las Condes', 'Salón Jardín', 'Sala Directorio Centro'])
      expect(router.state.location.search).toBe('?minPrice=20000')
    })

    it('el rango toma el mínimo y el máximo, con los extremos incluidos', async () => {
      const router = await openCatalog()

      await userEvent.selectOptions(select('Precio mínimo'), 'Desde $10.000 / hora')
      await userEvent.selectOptions(select('Precio máximo'), 'Hasta $15.000 / hora')

      expect(await screen.findByText('4 espacios')).toBeInTheDocument()
      expect(names()).toEqual([
        'Sala Alameda',
        'Cocina taller Providencia',
        'Estudio de grabación Ñuñoa',
        'Taller de cerámica',
      ])
      expect(router.state.location.search).toBe('?minPrice=10000&maxPrice=15000')
    })

    it('no deja armar un rango al revés: las opciones que lo invertirían están deshabilitadas', async () => {
      await openCatalog('/?minPrice=15000&maxPrice=20000')
      await screen.findByText(/^\d+ espacios?$/)

      const maxOption = (text: string) => within(select('Precio máximo')).getByRole('option', { name: text })
      const minOption = (text: string) => within(select('Precio mínimo')).getByRole('option', { name: text })
      expect(maxOption('Hasta $10.000 / hora')).toBeDisabled()
      expect(maxOption('Hasta $15.000 / hora')).toBeEnabled()
      expect(maxOption('Hasta $30.000 / hora')).toBeEnabled()
      expect(minOption('Desde $30.000 / hora')).toBeDisabled()
      expect(minOption('Desde $20.000 / hora')).toBeEnabled()
      expect(minOption('Desde $5.000 / hora')).toBeEnabled()
    })

    it('"Por día" aplica el rango al precio por día, con otras opciones', async () => {
      const router = await openCatalog()

      await userEvent.click(screen.getByRole('button', { name: 'Por día' }))

      expect(await screen.findByRole('button', { name: 'Por día', pressed: true })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Por hora', pressed: false })).toBeInTheDocument()
      expect(within(select('Precio máximo')).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Precio máximo',
        'Hasta $30.000 / día',
        'Hasta $50.000 / día',
        'Hasta $80.000 / día',
        'Hasta $120.000 / día',
        'Hasta $200.000 / día',
      ])
      // La unidad sola no filtra nada: se ven todos y no hay nada que limpiar.
      expect(router.state.location.search).toBe('?priceUnit=day')
      expect(screen.getByText('14 espacios')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()

      await userEvent.selectOptions(select('Precio máximo'), 'Hasta $50.000 / día')

      expect(await screen.findByText('2 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Cowork Plaza Ñuñoa', 'Oficina compartida Providencia'])
      expect(router.state.location.search).toBe('?priceUnit=day&maxPrice=50000')
    })

    it('un espacio que solo se arrienda por día aparece al filtrar por día', async () => {
      await openCatalog('/?priceUnit=day&minPrice=200000')

      expect(await screen.findByText('2 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Salón Jardín', 'Bodega de eventos Santiago'])
    })

    it('cambiar de unidad empieza el precio de nuevo, porque las escalas no se parecen', async () => {
      const router = await openCatalog('/?minPrice=10000&maxPrice=20000')
      await screen.findByText(/^\d+ espacios?$/)

      await userEvent.click(screen.getByRole('button', { name: 'Por día' }))

      expect(await screen.findByText('14 espacios')).toBeInTheDocument()
      expect(router.state.location.search).toBe('?priceUnit=day')
      expect(select('Precio mínimo')).toHaveDisplayValue('Precio mínimo')
      expect(select('Precio máximo')).toHaveDisplayValue('Precio máximo')
    })

    it('elegir "Cualquier…" quita el filtro', async () => {
      const router = await openCatalog('/?minCapacity=15')
      await screen.findByText('3 espacios')

      await userEvent.selectOptions(select('Capacidad mínima'), 'Cualquier capacidad')

      expect(await screen.findByText('14 espacios')).toBeInTheDocument()
      expect(router.state.location.search).toBe('')
    })

    it('si el valor de la URL no es una de las opciones, el selector igual lo muestra', async () => {
      await openCatalog('/?maxPrice=12000&minCapacity=6')

      expect(select('Precio máximo')).toHaveDisplayValue('Hasta $12.000 / hora')
      expect(select('Capacidad mínima')).toHaveDisplayValue('6 o más personas')
    })
  })

  describe('texto libre', () => {
    it('busca al enviar con Enter y lo deja en la URL', async () => {
      const router = await openCatalog()

      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'sala{Enter}')

      expect(await screen.findByText('4 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Sala Alameda', 'Sala de ensayo Los Olivos', 'Sala Directorio Centro', 'Sala de ensayo Centro'])
      expect(router.state.location.search).toBe('?q=sala')
    })

    it('busca también con el botón, sin distinguir mayúsculas y exigiendo cada palabra', async () => {
      await openCatalog()

      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), '  SALA ensayo ')
      await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

      expect(await screen.findByText('2 espacios')).toBeInTheDocument()
      expect(names()).toEqual(['Sala de ensayo Los Olivos', 'Sala de ensayo Centro'])
    })

    it('no busca mientras se escribe, solo al enviar', async () => {
      const router = await openCatalog()
      const calls = spyOnCatalog()

      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'sala')

      expect(calls).toEqual([])
      expect(router.state.location.search).toBe('')
    })

    it('enviarlo vacío quita la búsqueda', async () => {
      const router = await openCatalog('/?q=sala')
      const box = screen.getByRole('searchbox', { name: 'Buscar espacios' })
      expect(box).toHaveValue('sala')
      await screen.findByText('4 espacios')

      await userEvent.clear(box)
      await userEvent.type(box, '{Enter}')

      expect(await screen.findByText('14 espacios')).toBeInTheDocument()
      expect(router.state.location.search).toBe('')
    })
  })

  describe('la URL', () => {
    it('abre con los filtros de la URL ya aplicados y reflejados en los controles', async () => {
      await openCatalog('/?q=taller&typeId=8&communeId=3&minCapacity=8&minPrice=10000&maxPrice=20000')

      expect(await screen.findByText('1 espacio')).toBeInTheDocument()
      expect(names()).toEqual(['Taller de cerámica'])
      expect(screen.getByRole('searchbox', { name: 'Buscar espacios' })).toHaveValue('taller')
      expect(screen.getByRole('button', { name: 'Taller', pressed: true })).toBeInTheDocument()
      expect(select('Comuna')).toHaveDisplayValue('Ñuñoa')
      expect(select('Capacidad mínima')).toHaveDisplayValue('8 o más personas')
      expect(select('Precio mínimo')).toHaveDisplayValue('Desde $10.000 / hora')
      expect(select('Precio máximo')).toHaveDisplayValue('Hasta $20.000 / hora')
    })

    it('manda a la API los filtros de la URL, y nada de lo que no se eligió', async () => {
      const calls = spyOnCatalog()
      renderCatalog('/?q=taller&typeId=8&maxPrice=20000')
      await screen.findByText(/^\d+ espacios?$/)

      expect(Object.fromEntries(calls[0].searchParams)).toEqual({
        page: '1',
        pageSize: '12',
        q: 'taller',
        typeId: '8',
        priceUnit: 'hour',
        maxPrice: '20000',
      })
    })

    it('la unidad solo viaja a la API junto con un precio', async () => {
      const calls = spyOnCatalog()
      await openCatalog('/?priceUnit=day')
      expect(calls[0].searchParams.has('priceUnit')).toBe(false)

      renderCatalog('/?priceUnit=day&minPrice=30000&maxPrice=80000')
      await screen.findAllByText(/^\d+ espacios?$/)

      const withPrice = calls.find((url) => url.searchParams.has('minPrice'))!
      expect(Object.fromEntries(withPrice.searchParams)).toMatchObject({ priceUnit: 'day', minPrice: '30000', maxPrice: '80000' })
    })

    it('un mínimo mayor que el máximo en la URL se ignora en vez de provocar un error', async () => {
      await openCatalog('/?minPrice=30000&maxPrice=10000')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(select('Precio mínimo')).toHaveDisplayValue('Precio mínimo')
      expect(select('Precio máximo')).toHaveDisplayValue('Hasta $10.000 / hora')
    })

    it('un filtro combinado deja todos los parámetros en un orden fijo', async () => {
      const router = await openCatalog()

      await userEvent.click(screen.getByRole('button', { name: 'Taller' }))
      await userEvent.selectOptions(select('Comuna'), 'Ñuñoa')

      expect(await screen.findByText('1 espacio')).toBeInTheDocument()
      expect(names()).toEqual(['Taller de cerámica'])
      expect(router.state.location.search).toBe('?typeId=8&communeId=3')
    })

    it.each(['/?typeId=abc&minCapacity=0&maxPrice=-5', '/?communeId=99999999999&q=%20'])(
      'los valores inválidos (%s) se ignoran y se ve todo el catálogo',
      async (path) => {
        const calls = spyOnCatalog()
        await openCatalog(path)

        expect(screen.getByText('14 espacios')).toBeInTheDocument()
        expect(calls[0].searchParams.has('typeId')).toBe(false)
        expect(calls[0].searchParams.has('communeId')).toBe(false)
        expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
      },
    )

    it('cambiar un filtro vuelve a la primera página', async () => {
      const router = await openCatalog('/?page=2')
      await screen.findByRole('heading', { level: 3, name: 'Taller de cerámica' })

      await userEvent.click(screen.getByRole('button', { name: 'Taller' }))

      expect(await screen.findByText('2 espacios')).toBeInTheDocument()
      expect(router.state.location.search).toBe('?typeId=8')
    })

    it('los enlaces de la paginación conservan los filtros', async () => {
      const router = await openCatalog('/?maxPrice=40000')
      expect(await screen.findByText('13 espacios')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: 'Página 2' })
      expect(link).toHaveAttribute('href', '/?maxPrice=40000&page=2')

      await userEvent.click(link)

      expect(await screen.findByText('13 espacios')).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
      expect(router.state.location.search).toBe('?maxPrice=40000&page=2')
    })
  })

  describe('limpiar filtros', () => {
    it('aparece con algún filtro y los quita todos', async () => {
      const router = await openCatalog('/?q=sala&typeId=1&minCapacity=8')
      await screen.findByText(/^\d+ espacios?$/)

      await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

      expect(await screen.findByText('14 espacios')).toBeInTheDocument()
      expect(router.state.location.search).toBe('')
      expect(screen.getByRole('searchbox', { name: 'Buscar espacios' })).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
    })

    it('sin resultados lo dice y ofrece limpiar los filtros', async () => {
      await openCatalog('/?q=zzzz')

      expect(await screen.findByText('No encontramos espacios con esos filtros')).toBeInTheDocument()
      expect(screen.queryByText('Todavía no hay espacios publicados')).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()

      await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[1])

      expect(await screen.findByText('14 espacios')).toBeInTheDocument()
    })
  })

  it('si no cargan los tipos y las comunas, el catálogo y el buscador siguen funcionando', async () => {
    server.use(mswHttp.get('*/api/space-types', () => HttpResponse.json({ message: 'Caído' }, { status: 500 })))
    renderCatalog()

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Tipo de espacio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Comuna' })).not.toBeInTheDocument()
    expect(select('Capacidad mínima')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar espacios' }), 'taller{Enter}')

    // Dos talleres y la "Cocina taller".
    expect(await screen.findByText('3 espacios')).toBeInTheDocument()
  })
})
