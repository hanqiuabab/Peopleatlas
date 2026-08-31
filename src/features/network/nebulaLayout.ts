import type { Relationship } from '../../domain/relationship'
import { groupPeopleByFamily, relaxRelationshipLayout } from './relationshipLayout'

export interface NebulaPoint {
  x: number
  y: number
  depth: number
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

/**
 * Builds a deterministic, free-form cloud instead of a regular grid or sphere.
 * Callers should order ids by importance so that the most connected person is
 * placed closest to the visual core.
 */
export function buildNebulaLayout(ids: string[], relationships: Relationship[] = []): Record<string, NebulaPoint> {
  if (ids.length === 0) return {}

  const initial = Object.fromEntries(ids.map((id, index) => {
    if (index === 0) {
      return [id, { x: 0, y: 0, depth: 0.92 }]
    }

    const progress = index / Math.max(1, ids.length - 1)
    const jitter = (hashText(id) - 0.5) * 0.58
    const angle = index * GOLDEN_ANGLE + jitter
    const radius = 0.25 + Math.sqrt(progress) * 0.72

    return [id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.78,
      depth: Math.sin(angle * 1.43 + jitter) * 0.75,
    }]
  }))
  const points = Object.fromEntries(ids.map((id) => [id, { x: initial[id].x, y: initial[id].y, z: 0 }]))
  // Independent families need separate patches: their golden-angle centroids
  // would otherwise all approach the origin as their internal links contract.
  const rank = new Map(ids.map((id, index) => [id, index]))
  const families = groupPeopleByFamily(ids, relationships)
    .sort((a, b) => Math.min(...a.map((id) => rank.get(id)!)) - Math.min(...b.map((id) => rank.get(id)!)))
  if (families.some((family) => family.length > 1) && families.length > 1) {
    families.forEach((family, groupIndex) => {
      const angle = groupIndex * GOLDEN_ANGLE
      const spread = groupIndex === 0 ? 0 : 0.5 + 0.32 * Math.sqrt(groupIndex / (families.length - 1))
      const center = { x: Math.cos(angle) * spread, y: Math.sin(angle) * spread * 0.86 }
      const members = family.filter((id) => id !== ids[0])
      members.forEach((id, index) => {
        const localAngle = index * Math.PI * 2 / members.length + angle
        const radius = family.length === 1 ? 0 : Math.min(0.28, 0.17 + Math.sqrt(family.length) * 0.04)
        points[id] = {
          x: center.x + Math.cos(localAngle) * radius,
          y: center.y + Math.sin(localAngle) * radius,
          z: 0,
        }
      })
    })
  }
  const relaxed = relaxRelationshipLayout(points, relationships, 'cloud', ids[0])
  return Object.fromEntries(ids.map((id) => [id, { ...initial[id], x: relaxed[id].x, y: relaxed[id].y }]))
}
