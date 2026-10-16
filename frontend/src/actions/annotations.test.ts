import { describe, expect, it } from 'vitest'
import { convexHull, groupColor } from './annotations'

describe('convexHull', () => {
  it('drops interior points and keeps the corners', () => {
    const hull = convexHull([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [2, 3],
    ])
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual([5, 5])
  })

  it('drops collinear points on an edge', () => {
    expect(
      convexHull([
        [0, 0],
        [5, 0],
        [10, 0],
        [5, 5],
      ])
    ).toHaveLength(3)
  })

  it('returns tiny inputs unchanged', () => {
    expect(convexHull([[1, 2]])).toEqual([[1, 2]])
  })
})

describe('groupColor', () => {
  it('is stable per key and distinct across keys', () => {
    expect(groupColor('a')).toBe(groupColor('a'))
    expect(groupColor('a')).not.toBe(groupColor('b'))
  })
})
