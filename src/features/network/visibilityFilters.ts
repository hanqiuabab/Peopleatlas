import type { Gender, Person } from '../../domain/person'
import {
  RELATIONSHIP_TYPES,
  type Relationship,
  type RelationshipType,
} from '../../domain/relationship'

export interface NetworkVisibilityFilters {
  visibleGenders: ReadonlySet<Gender>
  showRelationships: boolean
  visibleRelationshipTypes: ReadonlySet<RelationshipType>
}

export function createRelationshipTypeVisibility(showAll: boolean): Set<RelationshipType> {
  return showAll ? new Set(RELATIONSHIP_TYPES) : new Set()
}

export function toggleRelationshipTypeVisibility(
  current: ReadonlySet<RelationshipType>,
  type: RelationshipType,
) {
  const visibleRelationshipTypes = new Set(current)
  if (visibleRelationshipTypes.has(type)) visibleRelationshipTypes.delete(type)
  else visibleRelationshipTypes.add(type)

  return {
    showRelationships: visibleRelationshipTypes.size > 0,
    visibleRelationshipTypes,
  }
}

export function filterNetworkByVisibility(
  people: Person[],
  relationships: Relationship[],
  filters: NetworkVisibilityFilters,
) {
  const visiblePeople = people.filter((person) => filters.visibleGenders.has(person.gender))
  const visiblePersonIds = new Set(visiblePeople.map((person) => person.id))
  const visibleRelationships = filters.showRelationships
    ? relationships.filter((relationship) => (
        visiblePersonIds.has(relationship.sourcePersonId)
        && visiblePersonIds.has(relationship.targetPersonId)
        && filters.visibleRelationshipTypes.has(relationship.type)
      ))
    : []

  return { visiblePeople, visibleRelationships }
}
