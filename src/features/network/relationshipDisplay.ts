import {
  RELATIONSHIP_LABELS,
  isDirectedRelationship,
  type Relationship,
} from '../../domain/relationship'

export interface RelationshipDisplayEdge {
  relationship: Relationship
  inverseRelationship?: Relationship
  relationshipIds: string[]
  label: string
  hasForwardDirection: boolean
  hasReverseDirection: boolean
}

export function groupRelationshipsForDisplay(
  relationships: Relationship[],
): RelationshipDisplayEdge[] {
  const relationshipById = new Map(relationships.map((relationship) => [relationship.id, relationship]))
  const visitedIds = new Set<string>()
  const displayEdges: RelationshipDisplayEdge[] = []

  relationships.forEach((relationship) => {
    if (visitedIds.has(relationship.id)) return
    const inverseRelationship = relationship.inverseRelationshipId
      ? relationshipById.get(relationship.inverseRelationshipId)
      : undefined
    const linkedInverse = inverseRelationship?.inverseRelationshipId === relationship.id
      ? inverseRelationship
      : undefined

    visitedIds.add(relationship.id)
    if (linkedInverse) visitedIds.add(linkedInverse.id)

    const relationshipLabel = RELATIONSHIP_LABELS[relationship.type]
    const inverseLabel = linkedInverse ? RELATIONSHIP_LABELS[linkedInverse.type] : undefined
    displayEdges.push({
      relationship,
      inverseRelationship: linkedInverse,
      relationshipIds: linkedInverse ? [relationship.id, linkedInverse.id] : [relationship.id],
      label: inverseLabel && inverseLabel !== relationshipLabel
        ? `${relationshipLabel} ↔ ${inverseLabel}`
        : relationshipLabel,
      hasForwardDirection: isDirectedRelationship(relationship.type),
      hasReverseDirection: Boolean(linkedInverse && isDirectedRelationship(linkedInverse.type)),
    })
  })

  return displayEdges
}
