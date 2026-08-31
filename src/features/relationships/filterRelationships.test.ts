import { describe, expect, it } from 'vitest'
import type { Relationship } from '../../domain/relationship'
import { filterRelationshipsByPerson } from './filterRelationships'

const relationships: Relationship[] = [
  { id: 'r1', sourcePersonId: 'p1', targetPersonId: 'p2', type: 'father', createdAt: '', updatedAt: '' },
  { id: 'r2', sourcePersonId: 'p3', targetPersonId: 'p1', type: 'colleague', createdAt: '', updatedAt: '' },
  { id: 'r3', sourcePersonId: 'p2', targetPersonId: 'p3', type: 'wife', createdAt: '', updatedAt: '' },
]

describe('filterRelationshipsByPerson', () => {
  it('includes relationships where the person is either source or target', () => {
    expect(filterRelationshipsByPerson(relationships, 'p1').map((item) => item.id)).toEqual([
      'r1',
      'r2',
    ])
  })

  it('returns an empty list for a person without relationships', () => {
    expect(filterRelationshipsByPerson(relationships, 'p4')).toEqual([])
  })

  it('returns all relationships when no person is selected', () => {
    expect(filterRelationshipsByPerson(relationships)).toBe(relationships)
  })
})

