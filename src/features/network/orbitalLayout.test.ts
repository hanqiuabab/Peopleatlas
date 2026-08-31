import { describe, expect, it } from 'vitest'
import { buildSphereLayout, projectSpherePoint } from './orbitalLayout'

describe('orbital sphere layout', () => {
  it('places every person on the unit sphere', () => {
    const layout = buildSphereLayout(['a', 'b', 'c', 'd', 'e'])
    expect(Object.keys(layout)).toHaveLength(5)
    Object.values(layout).forEach((point) => {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1, 5)
    })
  })

  it('projects rotation into different screen coordinates', () => {
    const point = { x: 1, y: 0, z: 0 }
    const initial = projectSpherePoint(point, 0, 100, 300, 200)
    const rotated = projectSpherePoint(point, Math.PI / 2, 100, 300, 200)
    expect(initial.x).not.toBeCloseTo(rotated.x)
    expect(initial.y).not.toBeCloseTo(rotated.y)
    expect(initial.scale).not.toBeCloseTo(rotated.scale)
  })
})

