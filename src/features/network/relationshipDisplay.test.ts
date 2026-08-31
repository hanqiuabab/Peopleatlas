import { describe, expect, it } from 'vitest'
import type { Relationship } from '../../domain/relationship'
import { groupRelationshipsForDisplay } from './relationshipDisplay'

const father: Relationship = {
  id: 'father',
  inverseRelationshipId: 'daughter',
  sourcePersonId: 'parent',
  targetPersonId: 'child',
  type: 'father',
  createdAt: '',
  updatedAt: '',
}

const daughter: Relationship = {
  id: 'daughter',
  inverseRelationshipId: 'father',
  sourcePersonId: 'child',
  targetPersonId: 'parent',
  type: 'daughter',
  createdAt: '',
  updatedAt: '',
}

describe('relationship display grouping', () => {
  it('combines an inverse pair into one bidirectional display edge', () => {
    expect(groupRelationshipsForDisplay([father, daughter])).toEqual([
      expect.objectContaining({
        relationship: father,
        inverseRelationship: daughter,
        relationshipIds: ['father', 'daughter'],
        label: '父亲 ↔ 女儿',
        hasForwardDirection: true,
        hasReverseDirection: true,
      }),
    ])
  })

  it('keeps a filtered or unpaired relationship as one directional edge', () => {
    expect(groupRelationshipsForDisplay([father])).toEqual([
      expect.objectContaining({
        relationship: father,
        inverseRelationship: undefined,
        relationshipIds: ['father'],
        label: '父亲',
        hasForwardDirection: true,
        hasReverseDirection: false,
      }),
    ])
  })

  it('combines reciprocal colleague records without duplicating the label or arrows', () => {
    const colleagueA: Relationship = {
      ...father,
      id: 'colleague-a',
      inverseRelationshipId: 'colleague-b',
      type: 'colleague',
    }
    const colleagueB: Relationship = {
      ...daughter,
      id: 'colleague-b',
      inverseRelationshipId: 'colleague-a',
      type: 'colleague',
    }

    expect(groupRelationshipsForDisplay([colleagueA, colleagueB])).toEqual([
      expect.objectContaining({
        label: '同事',
        hasForwardDirection: false,
        hasReverseDirection: false,
      }),
    ])
  })
})
