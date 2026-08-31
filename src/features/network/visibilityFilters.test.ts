import { describe, expect, it } from 'vitest'
import { GENDERS } from '../../domain/person'
import { RELATIONSHIP_TYPES } from '../../domain/relationship'
import {
  createRelationshipTypeVisibility,
  filterNetworkByVisibility,
  toggleRelationshipTypeVisibility,
} from './visibilityFilters'

const people = [
  { id: 'male', name: '明', gender: 'male' as const, createdAt: '', updatedAt: '' },
  { id: 'female', name: '兰', gender: 'female' as const, createdAt: '', updatedAt: '' },
  { id: 'female-2', name: '芳', gender: 'female' as const, createdAt: '', updatedAt: '' },
]

const relationships = [
  { id: 'colleague', sourcePersonId: 'male', targetPersonId: 'female', type: 'colleague' as const, createdAt: '', updatedAt: '' },
  { id: 'sister', sourcePersonId: 'female', targetPersonId: 'female-2', type: 'older_sister' as const, createdAt: '', updatedAt: '' },
]

const allTypes = new Set(RELATIONSHIP_TYPES)

describe('network visibility filters', () => {
  it('turns every relationship type on or off with the master relationship toggle', () => {
    expect([...createRelationshipTypeVisibility(true)]).toEqual(RELATIONSHIP_TYPES)
    expect([...createRelationshipTypeVisibility(false)]).toEqual([])
  })

  it('re-enables relationships when one type is selected after the master toggle is off', () => {
    const enabled = toggleRelationshipTypeVisibility(new Set(), 'father')

    expect(enabled.showRelationships).toBe(true)
    expect([...enabled.visibleRelationshipTypes]).toEqual(['father'])

    const disabled = toggleRelationshipTypeVisibility(
      enabled.visibleRelationshipTypes,
      'father',
    )
    expect(disabled.showRelationships).toBe(false)
    expect([...disabled.visibleRelationshipTypes]).toEqual([])
  })

  it('shows every person and relationship by default', () => {
    const result = filterNetworkByVisibility(people, relationships, {
      visibleGenders: new Set(GENDERS),
      showRelationships: true,
      visibleRelationshipTypes: allTypes,
    })

    expect(result.visiblePeople).toHaveLength(3)
    expect(result.visibleRelationships).toHaveLength(2)
  })

  it('hides relationships whose endpoint is filtered out', () => {
    const result = filterNetworkByVisibility(people, relationships, {
      visibleGenders: new Set(['female']),
      showRelationships: true,
      visibleRelationshipTypes: allTypes,
    })

    expect(result.visiblePeople.map((person) => person.id)).toEqual(['female', 'female-2'])
    expect(result.visibleRelationships.map((relationship) => relationship.id)).toEqual(['sister'])
  })

  it('supports filtering one relationship type or all relationships', () => {
    const visibleRelationshipTypes = new Set(RELATIONSHIP_TYPES)
    visibleRelationshipTypes.delete('colleague')

    expect(filterNetworkByVisibility(people, relationships, {
      visibleGenders: new Set(GENDERS),
      showRelationships: true,
      visibleRelationshipTypes,
    }).visibleRelationships.map((relationship) => relationship.id)).toEqual(['sister'])

    expect(filterNetworkByVisibility(people, relationships, {
      visibleGenders: new Set(GENDERS),
      showRelationships: false,
      visibleRelationshipTypes: allTypes,
    }).visibleRelationships).toEqual([])
  })
})
