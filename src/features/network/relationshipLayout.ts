import type { Relationship, RelationshipType } from '../../domain/relationship'
import type { GraphPoint } from './graphConnection'

export interface ProximityLink {
  source: string
  target: string
  weight: number
}

const PROXIMITY_WEIGHTS: Record<RelationshipType, number> = {
  husband: 12, wife: 12,
  older_brother: 8, older_sister: 8, younger_brother: 8, younger_sister: 8,
  father: 5, mother: 5, son: 5, daughter: 5,
  colleague: 1,
}

/** One undirected affinity per pair: inverse records must not double attraction. */
export function buildProximityLinks(ids: string[], relationships: Relationship[]): ProximityLink[] {
  const available = new Set(ids)
  const links = new Map<string, ProximityLink>()
  for (const relationship of relationships) {
    const [source, target] = [relationship.sourcePersonId, relationship.targetPersonId].sort()
    if (source === target || !available.has(source) || !available.has(target)) continue
    const key = JSON.stringify([source, target])
    const weight = PROXIMITY_WEIGHTS[relationship.type]
    if (weight > (links.get(key)?.weight ?? 0)) links.set(key, { source, target, weight })
  }
  return [...links.values()].sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
}

function walkComponents(ids: string[], links: ProximityLink[]): string[][] {
  const neighbors = new Map(ids.map((id) => [id, [] as { id: string; weight: number }[]]))
  for (const link of links) {
    neighbors.get(link.source)?.push({ id: link.target, weight: link.weight })
    neighbors.get(link.target)?.push({ id: link.source, weight: link.weight })
  }
  neighbors.forEach((items) => items.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)))
  const visited = new Set<string>()
  const components: string[][] = []
  for (const root of [...ids].sort()) {
    if (visited.has(root)) continue
    const component: string[] = []
    const stack = [root]
    while (stack.length) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      component.push(id)
      const next = neighbors.get(id) ?? []
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (!visited.has(next[index].id)) stack.push(next[index].id)
      }
    }
    components.push(component)
  }
  return components
}

export function groupPeopleByFamily(ids: string[], relationships: Relationship[]): string[][] {
  return walkComponents(ids, buildProximityLinks(ids, relationships).filter((link) => link.weight > 1))
}

/** Keep families contiguous; within each family visit spouses, siblings, then children. */
export function orderPeopleByRelationships(ids: string[], relationships: Relationship[]): string[] {
  const links = buildProximityLinks(ids, relationships)
  const families = walkComponents(ids, links.filter((link) => link.weight > 1))
  const familyByPerson = new Map(families.flatMap((family) => family.map((id) => [id, family[0]])))
  const familiesById = new Map(families.map((family) => [family[0], family]))
  const colleagueLinks = links.filter((link) => link.weight === 1).map((link) => ({
    source: familyByPerson.get(link.source)!, target: familyByPerson.get(link.target)!, weight: 1,
  })).filter((link) => link.source !== link.target)
  return walkComponents([...familiesById.keys()], colleagueLinks)
    .flat().flatMap((id) => familiesById.get(id)!)
}

interface SpatialPoint { x: number; y: number; z: number }

/** Bounded, deterministic relaxation runs on data changes, never on animation frames. */
export function relaxRelationshipLayout(
  initial: Record<string, SpatialPoint>,
  relationships: Relationship[],
  shape: 'sphere' | 'cloud',
  pinnedId?: string,
): Record<string, SpatialPoint> {
  const ids = Object.keys(initial).sort()
  const indexById = new Map(ids.map((id, index) => [id, index]))
  const links = buildProximityLinks(ids, relationships).map((link) => ({
    ...link, a: indexById.get(link.source)!, b: indexById.get(link.target)!,
  }))
  if (!links.length) return initial
  const sphere = shape === 'sphere'
  const points = ids.map((id) => ({ ...initial[id] }))
  const anchors = ids.map((id) => initial[id])
  const minimumDistance = Math.min(sphere ? 0.22 : 0.18, (sphere ? 2.2 : 1.8) / Math.sqrt(ids.length))
  const iterations = ids.length > 400 ? 45 : 90
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const forces = points.map((point, index) => ({
      x: (anchors[index].x - point.x) * 0.025,
      y: (anchors[index].y - point.y) * 0.025,
      z: sphere ? (anchors[index].z - point.z) * 0.025 : 0,
    }))
    for (const link of links) {
      const a = points[link.a]
      const b = points[link.b]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dz = sphere ? b.z - a.z : 0
      const distance = Math.max(0.0001, Math.hypot(dx, dy, dz))
      const target = (sphere ? 0.32 : 0.24) * Math.sqrt(12 / link.weight)
      const strength = Math.max(0, distance - target) / distance * link.weight / 12 * 0.22
      for (const [index, sign] of [[link.a, 1], [link.b, -1]]) {
        forces[index].x += dx * strength * sign
        forces[index].y += dy * strength * sign
        forces[index].z += dz * strength * sign
      }
    }
    // A spatial grid bounds collision work to nearby points instead of all pairs.
    const cells = new Map<string, number[]>()
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`
    points.forEach((point, index) => {
      const cell = key(Math.floor(point.x / minimumDistance), Math.floor(point.y / minimumDistance),
        sphere ? Math.floor(point.z / minimumDistance) : 0)
      const entries = cells.get(cell) ?? []
      entries.push(index)
      cells.set(cell, entries)
    })
    points.forEach((a, index) => {
      const cx = Math.floor(a.x / minimumDistance)
      const cy = Math.floor(a.y / minimumDistance)
      const cz = sphere ? Math.floor(a.z / minimumDistance) : 0
      for (let ox = -1; ox <= 1; ox += 1) for (let oy = -1; oy <= 1; oy += 1) {
        for (let oz = sphere ? -1 : 0; oz <= (sphere ? 1 : 0); oz += 1) {
          for (const other of cells.get(key(cx + ox, cy + oy, cz + oz)) ?? []) {
            if (other <= index) continue
            const b = points[other]
            let dx = a.x - b.x
            let dy = a.y - b.y
            const dz = sphere ? a.z - b.z : 0
            let distance = Math.hypot(dx, dy, dz)
            if (distance >= minimumDistance) continue
            if (distance < 0.0001) {
              dx = Math.cos(index + other) * 0.0001
              dy = Math.sin(index + other) * 0.0001
              distance = 0.0001
            }
            const push = (minimumDistance - distance) / distance * 0.8
            for (const [target, sign] of [[index, 1], [other, -1]]) {
              forces[target].x += dx * push * sign
              forces[target].y += dy * push * sign
              forces[target].z += dz * push * sign
            }
          }
        }
      }
    })
    points.forEach((point, index) => {
      if (ids[index] === pinnedId) return
      const force = forces[index]
      const step = Math.min(1, 0.08 / Math.max(0.0001, Math.hypot(force.x, force.y, force.z)))
      point.x += force.x * step
      point.y += force.y * step
      point.z += force.z * step
      const radius = sphere ? Math.hypot(point.x, point.y, point.z) : Math.hypot(point.x, point.y)
      const divisor = sphere ? Math.max(0.0001, radius) : Math.max(1, radius)
      point.x /= divisor
      point.y /= divisor
      if (sphere) point.z /= divisor
    })
  }
  return Object.fromEntries(ids.map((id, index) => [id, points[index]]))
}

export function reconcileFreePositions(
  defaults: Record<string, GraphPoint>,
  current: Record<string, GraphPoint>,
  manuallyPlaced: ReadonlySet<string>,
  preserveCurrent = false,
): Record<string, GraphPoint> {
  return Object.fromEntries(Object.entries(defaults).map(([id, point]) => [
    id, current[id] && (preserveCurrent || manuallyPlaced.has(id)) ? current[id] : point,
  ]))
}
