import { describe, expect, it } from 'vitest'
import { MAX_PHOTO_BYTES, moveItem, selectPhotos } from './photo-rules'

const file = (name: string, type = 'image/png', size = 1000) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('selectPhotos', () => {
  it('acepta JPG, PNG y WebP en el orden elegido', () => {
    const files = [file('a.jpg', 'image/jpeg'), file('b.png'), file('c.webp', 'image/webp')]

    const { accepted, problems } = selectPhotos(files, 0)

    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'b.png', 'c.webp'])
    expect(problems).toEqual([])
  })

  it('rechaza lo que no es JPG, PNG o WebP y dice cuál archivo es', () => {
    const { accepted, problems } = selectPhotos([file('a.gif', 'image/gif'), file('b.pdf', 'application/pdf'), file('c.png')], 0)

    expect(accepted.map((f) => f.name)).toEqual(['c.png'])
    expect(problems).toEqual(['a.gif: usa una foto JPG, PNG o WebP.', 'b.pdf: usa una foto JPG, PNG o WebP.'])
  })

  it('rechaza las que pesan más de 5 MB y acepta una de justo 5 MB', () => {
    const { accepted, problems } = selectPhotos([file('grande.png', 'image/png', MAX_PHOTO_BYTES + 1), file('justa.png', 'image/png', MAX_PHOTO_BYTES)], 0)

    expect(accepted.map((f) => f.name)).toEqual(['justa.png'])
    expect(problems).toEqual(['grande.png: pesa más de 5 MB.'])
  })

  it('solo deja subir las que caben hasta 10 y avisa de las que sobran', () => {
    const files = Array.from({ length: 5 }, (_, i) => file(`f${i}.png`))

    const { accepted, problems } = selectPhotos(files, 8)

    expect(accepted.map((f) => f.name)).toEqual(['f0.png', 'f1.png'])
    expect(problems).toEqual(['Un espacio puede tener hasta 10 fotos: no se subieron 3 fotos por falta de lugar.'])
  })

  it('con una sola que sobra lo dice en singular', () => {
    const { problems } = selectPhotos([file('a.png'), file('b.png')], 9)

    expect(problems).toEqual(['Un espacio puede tener hasta 10 fotos: no se subió 1 foto por falta de lugar.'])
  })

  it('con 10 fotos ya subidas no acepta ninguna', () => {
    const { accepted, problems } = selectPhotos([file('a.png')], 10)

    expect(accepted).toEqual([])
    expect(problems).toHaveLength(1)
  })

  it('las inválidas no ocupan lugar de las válidas', () => {
    const { accepted } = selectPhotos([file('mala.gif', 'image/gif'), file('a.png'), file('b.png')], 8)

    expect(accepted.map((f) => f.name)).toEqual(['a.png', 'b.png'])
  })

  it('sin archivos no hay nada que subir ni que avisar', () => {
    expect(selectPhotos([], 3)).toEqual({ accepted: [], problems: [] })
  })
})

describe('moveItem', () => {
  const ids = ['a', 'b', 'c', 'd']

  it.each([
    [1, 0, ['b', 'a', 'c', 'd']],
    [0, 1, ['b', 'a', 'c', 'd']],
    [3, 0, ['d', 'a', 'b', 'c']],
    [0, 3, ['b', 'c', 'd', 'a']],
    [2, 1, ['a', 'c', 'b', 'd']],
  ])('mover de %i a %i', (from, to, expected) => {
    expect(moveItem(ids, from, to)).toEqual(expected)
  })

  it.each([
    [1, 1],
    [-1, 0],
    [0, -1],
    [4, 0],
    [0, 4],
  ])('mover de %i a %i no cambia nada', (from, to) => {
    expect(moveItem(ids, from, to)).toEqual(ids)
  })

  it('no modifica la lista original', () => {
    const original = ['a', 'b', 'c']

    moveItem(original, 2, 0)

    expect(original).toEqual(['a', 'b', 'c'])
  })
})
