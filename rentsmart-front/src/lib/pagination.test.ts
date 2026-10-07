import { describe, expect, it } from 'vitest'
import { pageItems } from './pagination'

describe('pageItems', () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [2, 5, [1, 2, 3, 'gap', 5]],
    [1, 10, [1, 2, 'gap', 10]],
    [5, 10, [1, 'gap', 4, 5, 6, 'gap', 10]],
    [10, 10, [1, 'gap', 9, 10]],
  ])('página %i de %i', (page, total, expected) => {
    expect(pageItems(page, total)).toEqual(expected)
  })
})
