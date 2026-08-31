import { describe, expect, it } from 'vitest'
import type { Relationship, RelationshipType } from '../../domain/relationship'
import {
  buildHierarchyPositions,
  calculatePersonLevels,
  getRelationshipLevelDelta,
} from './hierarchyLayout'

function relationship(
  sourcePersonId: string,
  targetPersonId: string,
  type: RelationshipType,
): Relationship {
  return {
    id: `${sourcePersonId}-${targetPersonId}-${type}`,
    sourcePersonId,
    targetPersonId,
    type,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
  }
}

describe('hierarchy layout', () => {
  it('maps parent, child and peer relationships to the requested level deltas', () => {
    expect(getRelationshipLevelDelta('father')).toBe(1)
    expect(getRelationshipLevelDelta('mother')).toBe(1)
    expect(getRelationshipLevelDelta('son')).toBe(-1)
    expect(getRelationshipLevelDelta('daughter')).toBe(-1)
    expect(getRelationshipLevelDelta('colleague')).toBe(0)
    expect(getRelationshipLevelDelta('wife')).toBe(0)
    expect(getRelationshipLevelDelta('older_sister')).toBe(0)
  })

  it('calculates consistent generations when inverse relationships are both present', () => {
    const relationships = [
      relationship('grandfather', 'father', 'father'),
      relationship('father', 'grandfather', 'son'),
      relationship('father', 'child', 'father'),
      relationship('child', 'father', 'daughter'),
      relationship('child', 'colleague', 'colleague'),
    ]

    const levels = calculatePersonLevels(
      ['grandfather', 'father', 'child', 'colleague'],
      relationships,
    )

    expect(levels.grandfather).toBe(2)
    expect(levels.father).toBe(1)
    expect(levels.child).toBe(0)
    expect(levels.colleague).toBe(0)
  })

  it('places higher generations above lower generations and peers on one row', () => {
    const levels = { parent: 1, child: 0, colleague: 0 }
    const positions = buildHierarchyPositions(
      ['parent', 'child', 'colleague'],
      levels,
      900,
      620,
    )

    expect(positions.parent.y).toBeLessThan(positions.child.y)
    expect(positions.child.y).toBe(positions.colleague.y)
    expect(positions.child.x).not.toBe(positions.colleague.x)
  })

  it('produces a new generation layout after a relationship is modified', () => {
    const personIds = ['one', 'two']
    const peerLevels = calculatePersonLevels(
      personIds,
      [relationship('one', 'two', 'colleague')],
    )
    const parentLevels = calculatePersonLevels(
      personIds,
      [relationship('one', 'two', 'mother')],
    )
    const peerPositions = buildHierarchyPositions(personIds, peerLevels, 900, 620)
    const parentPositions = buildHierarchyPositions(personIds, parentLevels, 900, 620)

    expect(peerPositions.one.y).toBe(peerPositions.two.y)
    expect(parentPositions.one.y).toBeLessThan(parentPositions.two.y)
  })

  it('recomputes levels when a relationship is added or removed', () => {
    const personIds = ['parent', 'child']
    const initialLevels = calculatePersonLevels(personIds, [])
    const addedLevels = calculatePersonLevels(
      personIds,
      [relationship('parent', 'child', 'father')],
    )
    const removedLevels = calculatePersonLevels(personIds, [])

    expect(initialLevels).toEqual({ parent: -1, child: -1 })
    expect(addedLevels.parent).toBe(addedLevels.child + 1)
    expect(removedLevels).toEqual(initialLevels)
  })

  it('places unrelated people at level -1 below the connected family', () => {
    const ids = ['parent', 'child', 'alone', 'another']
    const levels = calculatePersonLevels(ids, [relationship('parent', 'child', 'father')])
    expect(levels).toEqual({ parent: 1, child: 0, alone: -1, another: -1 })
    const positions = buildHierarchyPositions(ids, levels, 900, 620)
    expect(positions.alone.y).toBeGreaterThan(positions.child.y)
    expect(positions.another.y).toBe(positions.alone.y)
  })

  it('treats either end of a colleague relationship as connected at level 0', () => {
    expect(calculatePersonLevels(['source', 'target', 'alone'], [relationship('source', 'target', 'colleague')]))
      .toEqual({ source: 0, target: 0, alone: -1 })
  })

  it('moves the disconnected endpoint to level -1 after a relationship endpoint is edited', () => {
    const ids = ['parent', 'child', 'other']
    const before = calculatePersonLevels(ids, [relationship('parent', 'child', 'father')])
    const after = calculatePersonLevels(ids, [relationship('parent', 'other', 'father')])
    expect(before).toEqual({ parent: 1, child: 0, other: -1 })
    expect(after).toEqual({ parent: 1, child: -1, other: 0 })
  })

  it('handles empty networks and ignores dangling and self relationships', () => {
    expect(calculatePersonLevels([], [])).toEqual({})
    expect(calculatePersonLevels(['alone'], [])).toEqual({ alone: -1 })
    expect(calculatePersonLevels(['alone'], [
      relationship('alone', 'missing', 'colleague'), relationship('alone', 'alone', 'father'),
    ])).toEqual({ alone: -1 })
  })
})
