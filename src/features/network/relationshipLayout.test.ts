import { describe, expect, it } from 'vitest'
import type { Relationship, RelationshipType } from '../../domain/relationship'
import { buildHierarchyPositions, calculatePersonLevels } from './hierarchyLayout'
import { buildNebulaLayout } from './nebulaLayout'
import { buildSphereLayout } from './orbitalLayout'
import { buildRingPositions } from './ringLayout'
import { buildProximityLinks, orderPeopleByRelationships, reconcileFreePositions } from './relationshipLayout'

const relation = (sourcePersonId: string, targetPersonId: string, type: RelationshipType): Relationship => ({
  id: `${sourcePersonId}:${targetPersonId}:${type}`, sourcePersonId, targetPersonId, type, createdAt: '', updatedAt: '',
})
const ids = ['a-parent', 'b-outsider', 'c-child', 'd-outsider', 'e-spouse', 'f-sibling', 'g-outsider', 'h-outsider']
const relationships = [
  relation('a-parent', 'e-spouse', 'husband'),
  relation('e-spouse', 'a-parent', 'wife'),
  relation('c-child', 'f-sibling', 'older_brother'),
  relation('f-sibling', 'c-child', 'younger_sister'),
  relation('a-parent', 'c-child', 'father'),
  relation('c-child', 'a-parent', 'son'),
]
const distance = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

describe('relationship-aware ordering', () => {
  it('counts inverse and duplicate records once, using the closest relationship', () => {
    expect(buildProximityLinks(ids, [...relationships, ...relationships,
      relation('a-parent', 'e-spouse', 'colleague'),
      relation('a-parent', 'a-parent', 'father'),
      relation('a-parent', 'missing', 'husband'),
    ])).toEqual([
      { source: 'a-parent', target: 'c-child', weight: 5 },
      { source: 'a-parent', target: 'e-spouse', weight: 12 },
      { source: 'c-child', target: 'f-sibling', weight: 8 },
    ])
  })

  it('places spouses and siblings next to each other, keeping the family together', () => {
    const ordered = orderPeopleByRelationships(ids, relationships)
    expect(ordered.slice(0, 4)).toEqual(['a-parent', 'e-spouse', 'c-child', 'f-sibling'])
    expect(new Set(ordered)).toEqual(new Set(ids))
  })

  it('does not split families when one family member has an outside colleague', () => {
    const ordered = orderPeopleByRelationships(ids, [...relationships, relation('e-spouse', 'b-outsider', 'colleague')])
    expect(ordered.slice(0, 4)).toEqual(['a-parent', 'e-spouse', 'c-child', 'f-sibling'])
  })

  it('is stable across insertion order, direction and repeated inverse records', () => {
    expect(orderPeopleByRelationships([...ids].reverse(), [...relationships].reverse()))
      .toEqual(orderPeopleByRelationships(ids, relationships))
    expect(orderPeopleByRelationships(ids, relationships.filter((_, index) => index % 2)))
      .toEqual(orderPeopleByRelationships(ids, relationships))
  })

  it('updates ring adjacency on add, edit and deletion without changing the rotation phase', () => {
    const before = orderPeopleByRelationships(ids, [])
    const added = orderPeopleByRelationships(ids, [relation('a-parent', 'e-spouse', 'husband')])
    const edited = orderPeopleByRelationships(ids, [relation('a-parent', 'h-outsider', 'husband')])
    expect(added.slice(0, 2)).toEqual(['a-parent', 'e-spouse'])
    expect(edited.slice(0, 2)).toEqual(['a-parent', 'h-outsider'])
    expect(orderPeopleByRelationships(ids, [])).toEqual(before)
    const ring = buildRingPositions(added, 900, 620, 0.6)
    expect(distance(ring['a-parent'], ring['e-spouse'])).toBeLessThan(distance(ring['a-parent'], ring['d-outsider']))
    expect(ring['a-parent']).toEqual(buildRingPositions(before, 900, 620, 0.6)['a-parent'])
  })

  it('retains generations while ordering spouses and siblings within their rows', () => {
    const levels = calculatePersonLevels(ids, relationships)
    const positions = buildHierarchyPositions(ids, levels, 900, 620, relationships)
    expect(positions['a-parent'].y).toBe(positions['e-spouse'].y)
    expect(positions['a-parent'].y).toBeLessThan(positions['c-child'].y)
    expect(positions['c-child'].y).toBe(positions['f-sibling'].y)
    const childRow = ids.filter((id) => positions[id].y === positions['c-child'].y)
      .sort((a, b) => positions[a].x - positions[b].x)
    expect(childRow.slice(0, 2)).toEqual(['c-child', 'f-sibling'])
  })

  it('handles empty, single and filtered networks without stale references', () => {
    expect(orderPeopleByRelationships([], relationships)).toEqual([])
    expect(orderPeopleByRelationships(['c-child'], relationships)).toEqual(['c-child'])
    const filtered = ids.filter((id) => id !== 'a-parent')
    expect(new Set(orderPeopleByRelationships(filtered, relationships))).toEqual(new Set(filtered))
  })
})

describe('relationship distances in sphere and cloud layouts', () => {
  for (const [name, build] of [['sphere', buildSphereLayout], ['cloud', buildNebulaLayout]] as const) {
    it(`${name} brings spouses and siblings closer in space, not just in array order`, () => {
      const before = build(ids)
      const after = build(ids, relationships)
      for (const [a, b] of [['a-parent', 'e-spouse'], ['c-child', 'f-sibling']]) {
        expect(distance(after[a], after[b])).toBeLessThan(distance(before[a], before[b]) * 0.8)
        expect(distance(after[a], after[b])).toBeGreaterThan(0.12)
      }
    })

    it(`${name} pulls spouses more closely than colleagues`, () => {
      const spouse = build(ids, [relation('c-child', 'h-outsider', 'wife')])
      const colleague = build(ids, [relation('c-child', 'h-outsider', 'colleague')])
      expect(distance(spouse['c-child'], spouse['h-outsider']))
        .toBeLessThan(distance(colleague['c-child'], colleague['h-outsider']))
    })

    it(`${name} is deterministic and unchanged by duplicate inverse records`, () => {
      const points = build(ids, relationships)
      expect(build(ids, [...relationships, ...relationships].reverse())).toEqual(points)
      expect(build(ids, relationships.filter((_, index) => index % 2))).toEqual(points)
      expect(Object.keys(points).sort()).toEqual([...ids].sort())
      for (const point of Object.values(points)) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true)
      }
    })

    it(`${name} refreshes coordinates after relation edits and restores the baseline after deletion`, () => {
      const original = build(ids)
      const added = build(ids, [relation('a-parent', 'e-spouse', 'husband')])
      const edited = build(ids, [relation('a-parent', 'f-sibling', 'father')])
      expect(added).not.toEqual(original)
      expect(edited).not.toEqual(added)
      expect(build(ids, [])).toEqual(original)
    })
  }

  it('keeps sphere nodes on the unit surface and the nebula core pinned', () => {
    Object.values(buildSphereLayout(ids, relationships)).forEach((point) => {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1)
    })
    const cloud = buildNebulaLayout(ids, relationships)
    expect(cloud[ids[0]]).toEqual({ x: 0, y: 0, depth: 0.92 })
    Object.values(cloud).forEach((point) => expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1.00001))
  })

  it('does not collapse a dense family to a single point', () => {
    const links = ids.flatMap((a, index) => ids.slice(index + 1).map((b) => relation(a, b, 'older_sister')))
    for (const build of [buildSphereLayout, buildNebulaLayout]) {
      const points = build(ids, links)
      ids.forEach((a, index) => ids.slice(index + 1).forEach((b) => {
        expect(distance(points[a], points[b])).toBeGreaterThan(0.06)
      }))
    }
  })

  it('gives independent nebula families separate patches instead of crowding the core', () => {
    const points = buildNebulaLayout(['a', 'b', 'c', 'd'], [relation('a', 'b', 'husband'), relation('c', 'd', 'older_sister')])
    const firstCenter = { x: (points.a.x + points.b.x) / 2, y: (points.a.y + points.b.y) / 2 }
    const secondCenter = { x: (points.c.x + points.d.x) / 2, y: (points.c.y + points.d.y) / 2 }
    expect(distance(firstCenter, secondCenter)).toBeGreaterThan(0.45)
    expect(distance(points.a, points.b)).toBeLessThan(distance(firstCenter, secondCenter))
    expect(distance(points.c, points.d)).toBeLessThan(distance(firstCenter, secondCenter))
  })

  it('handles empty, one-person and deleted-person layouts without stale coordinates', () => {
    for (const build of [buildSphereLayout, buildNebulaLayout]) {
      expect(build([], relationships)).toEqual({})
      expect(Object.keys(build(['a-parent'], relationships))).toEqual(['a-parent'])
      expect(Object.keys(build(ids.slice(1), relationships)).sort()).toEqual(ids.slice(1).sort())
    }
  })
})

describe('free layout manual placement', () => {
  it('updates automatic nodes but retains dragged ones, adding/removing people safely', () => {
    const defaults = { a: { x: 10, y: 10 }, b: { x: 20, y: 20 }, new: { x: 30, y: 30 } }
    const current = { a: { x: 100, y: 100 }, b: { x: 200, y: 200 }, deleted: { x: 0, y: 0 } }
    expect(reconcileFreePositions(defaults, current, new Set(['a']))).toEqual({
      a: current.a, b: defaults.b, new: defaults.new,
    })
  })

  it('preserves the current layout when leaving auto mode and clears manual placement on reset', () => {
    const defaults = { a: { x: 10, y: 10 }, b: { x: 20, y: 20 } }
    const current = { a: { x: 100, y: 100 }, b: { x: 200, y: 200 } }
    expect(reconcileFreePositions(defaults, current, new Set(), true)).toEqual(current)
    expect(reconcileFreePositions(defaults, current, new Set())).toEqual(defaults)
  })
})
