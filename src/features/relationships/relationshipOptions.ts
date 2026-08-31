import type { Person } from '../../domain/person'
import { getAvailableRelationshipTypes, type RelationshipType } from '../../domain/relationship'

export function getRelationshipOptions(
  people: Person[],
  sourcePersonId: string,
  targetPersonId: string,
): RelationshipType[] {
  const source = people.find((person) => person.id === sourcePersonId)
  const target = people.find((person) => person.id === targetPersonId)
  if (!source || !target || source.id === target.id) return []
  return getAvailableRelationshipTypes(source.gender, target.gender)
}
