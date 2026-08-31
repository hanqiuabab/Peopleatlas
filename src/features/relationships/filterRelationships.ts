import type { Relationship } from '../../domain/relationship'

export function filterRelationshipsByPerson(
  relationships: Relationship[],
  personId?: string,
) {
  if (!personId) return relationships
  return relationships.filter(
    (relationship) =>
      relationship.sourcePersonId === personId || relationship.targetPersonId === personId,
  )
}

