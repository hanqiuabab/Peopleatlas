import { describe, expect, it } from 'vitest'
import { buildRingPositions, getRingGeometry } from './ringLayout'

describe('ring layout', () => {
  it('handles empty and single-person networks', () => {
    expect(buildRingPositions([], 900, 620)).toEqual({})
    expect(buildRingPositions(['one'], 900, 620).one).toEqual(getRingGeometry(900, 620).center)
  })

  it('distributes people at equal angular intervals on a real circle', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const points = buildRingPositions(ids, 900, 620)
    const { center, radius } = getRingGeometry(900, 620)
    ids.forEach((id, index) => {
      const point = points[id]
      const next = points[ids[(index + 1) % ids.length]]
      expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeCloseTo(radius)
      expect(Math.hypot(point.x - next.x, point.y - next.y))
        .toBeCloseTo(2 * radius * Math.sin(Math.PI / ids.length))
    })
  })

  it('rotates coordinates while preserving the radius and center', () => {
    const { center, radius } = getRingGeometry(900, 620)
    const points = buildRingPositions(['a', 'b'], 900, 620, Math.PI / 2)
    expect(points.a.x).toBeCloseTo(center.x + radius)
    expect(points.a.y).toBeCloseTo(center.y)
    expect(points.b.x).toBeCloseTo(center.x - radius)
  })

  it('redistributes every remaining person after addition and deletion, retaining the phase', () => {
    const initial = buildRingPositions(['a', 'b', 'c'], 900, 620, 0.4)
    const added = buildRingPositions(['a', 'b', 'c', 'd'], 900, 620, 0.4)
    const deleted = buildRingPositions(['a', 'b', 'c'], 900, 620, 0.4)
    expect(added.a).toEqual(initial.a)
    expect(added.b).not.toEqual(initial.b)
    expect(Object.keys(added)).toHaveLength(4)
    expect(deleted).toEqual(initial)
    expect(deleted).not.toHaveProperty('d')
  })

  it.each([[340, 460], [1920, 1080], [0, 0]])('fits the resized %s × %s canvas', (width, height) => {
    const points = buildRingPositions(['a', 'b', 'c', 'd'], width, height, 0.5)
    Object.values(points).forEach(({ x, y }) => {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(height)
    })
  })
})
