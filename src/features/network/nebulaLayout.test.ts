import { describe, expect, it } from 'vitest'
import { buildNebulaLayout } from './nebulaLayout'

describe('buildNebulaLayout', () => {
  it('keeps the first and most important id at the visual core', () => {
    expect(buildNebulaLayout(['core', 'one', 'two']).core).toEqual({
      x: 0,
      y: 0,
      depth: 0.92,
    })
  })

  it('is deterministic and keeps every point inside the normalized cloud', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const first = buildNebulaLayout(ids)
    const second = buildNebulaLayout(ids)

    expect(second).toEqual(first)
    ids.forEach((id) => {
      expect(Math.abs(first[id].x)).toBeLessThanOrEqual(1)
      expect(Math.abs(first[id].y)).toBeLessThanOrEqual(1)
      expect(Math.abs(first[id].depth)).toBeLessThanOrEqual(1)
    })
  })
})
