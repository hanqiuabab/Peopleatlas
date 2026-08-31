import type { RelationshipNetwork } from './network'
import type { Person } from './person'
import { getInverseRelationshipType, type Relationship } from './relationship'
import { validateRelationshipInput, type RelationshipInput } from './networkValidation'

/** Build a new snapshot before the caller commits it, so failures never partially save. */
export function addRelationshipBatchToNetwork(
  network: RelationshipNetwork,
  inputs: RelationshipInput[],
  createId: () => string,
  now: string,
): RelationshipNetwork {
  let next = network
  for (const input of inputs) {
    const error = validateRelationshipInput(input, next.people, next.relationships)
    if (error) throw new Error(error)
    const inverse = getInverseRelationshipInput(input, next.people)
    const inverseError = inverse
      ? validateRelationshipInput(inverse, next.people, next.relationships)
      : '无法根据人物信息创建反向关系'
    if (inverseError) throw new Error(inverseError)
    next = addRelationshipPairToNetwork(next, input, createId, now).network
  }
  return next
}

export function getInverseRelationshipInput(
  input: RelationshipInput,
  people: Person[],
): RelationshipInput | null {
  const reverseSource = people.find((person) => person.id === input.targetPersonId)
  if (!reverseSource) return null
  return {
    sourcePersonId: input.targetPersonId,
    targetPersonId: input.sourcePersonId,
    type: getInverseRelationshipType(input.type, reverseSource.gender),
  }
}

function matchesInput(relationship: Relationship, input: RelationshipInput) {
  return relationship.sourcePersonId === input.sourcePersonId
    && relationship.targetPersonId === input.targetPersonId
    && relationship.type === input.type
}

export function addRelationshipPairToNetwork(
  network: RelationshipNetwork,
  input: RelationshipInput,
  createId: () => string,
  now: string,
): { network: RelationshipNetwork; relationship: Relationship } {
  const inverseInput = getInverseRelationshipInput(input, network.people)
  if (!inverseInput) throw new Error('Cannot create an inverse relationship without a target person')
  const relationshipId = createId()
  const inverseRelationshipId = createId()
  const relationship: Relationship = {
    id: relationshipId,
    inverseRelationshipId,
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  const inverseRelationship: Relationship = {
    id: inverseRelationshipId,
    inverseRelationshipId: relationshipId,
    ...inverseInput,
    createdAt: now,
    updatedAt: now,
  }
  return {
    relationship,
    network: {
      ...network,
      relationships: [...network.relationships, relationship, inverseRelationship],
    },
  }
}

export function updateRelationshipPairInNetwork(
  network: RelationshipNetwork,
  relationshipId: string,
  input: RelationshipInput,
  createId: () => string,
  now: string,
): RelationshipNetwork {
  const current = network.relationships.find((relationship) => relationship.id === relationshipId)
  if (!current) return network
  const inverseInput = getInverseRelationshipInput(input, network.people)
  if (!inverseInput) return network
  const linkedInverse = network.relationships.find(
    (relationship) => relationship.id === current.inverseRelationshipId,
  )
  const inverseRelationshipId = linkedInverse?.id ?? createId()
  const updatedRelationship: Relationship = {
    ...current,
    ...input,
    inverseRelationshipId,
    updatedAt: now,
  }
  const updatedInverse: Relationship = linkedInverse
    ? {
        ...linkedInverse,
        ...inverseInput,
        inverseRelationshipId: current.id,
        updatedAt: now,
      }
    : {
        id: inverseRelationshipId,
        inverseRelationshipId: current.id,
        ...inverseInput,
        createdAt: now,
        updatedAt: now,
      }

  return {
    ...network,
    relationships: linkedInverse
      ? network.relationships.map((relationship) => {
          if (relationship.id === current.id) return updatedRelationship
          if (relationship.id === linkedInverse.id) return updatedInverse
          return relationship
        })
      : [...network.relationships.map((relationship) => (
          relationship.id === current.id ? updatedRelationship : relationship
        )), updatedInverse],
  }
}

export function ensureInverseRelationships(
  network: RelationshipNetwork,
  createId: () => string,
  now: string,
): RelationshipNetwork {
  const relationships = network.relationships.map((relationship) => ({ ...relationship }))
  const originalRelationshipIds = relationships.map((relationship) => relationship.id)
  const pairedIds = new Set<string>()

  originalRelationshipIds.forEach((relationshipId) => {
    if (pairedIds.has(relationshipId)) return
    const relationshipIndex = relationships.findIndex((item) => item.id === relationshipId)
    const relationship = relationships[relationshipIndex]
    if (!relationship) return
    const inverseInput = getInverseRelationshipInput(relationship, network.people)
    if (!inverseInput) return

    const linkedIndex = relationships.findIndex(
      (item) => item.id === relationship.inverseRelationshipId,
    )
    if (linkedIndex >= 0) {
      const linked = relationships[linkedIndex]
      relationships[relationshipIndex] = { ...relationship, inverseRelationshipId: linked.id }
      relationships[linkedIndex] = {
        ...linked,
        ...inverseInput,
        inverseRelationshipId: relationship.id,
        updatedAt: now,
      }
      pairedIds.add(relationship.id)
      pairedIds.add(linked.id)
      return
    }

    const matchingIndex = relationships.findIndex(
      (item) => item.id !== relationship.id && !pairedIds.has(item.id) && matchesInput(item, inverseInput),
    )
    if (matchingIndex >= 0) {
      const matching = relationships[matchingIndex]
      relationships[relationshipIndex] = { ...relationship, inverseRelationshipId: matching.id }
      relationships[matchingIndex] = { ...matching, inverseRelationshipId: relationship.id }
      pairedIds.add(relationship.id)
      pairedIds.add(matching.id)
      return
    }

    const inverseRelationshipId = createId()
    relationships[relationshipIndex] = { ...relationship, inverseRelationshipId }
    relationships.push({
      id: inverseRelationshipId,
      inverseRelationshipId: relationship.id,
      ...inverseInput,
      createdAt: relationship.createdAt || now,
      updatedAt: now,
    })
    pairedIds.add(relationship.id)
    pairedIds.add(inverseRelationshipId)
  })

  return { ...network, relationships }
}

export function removePersonFromNetwork(
  network: RelationshipNetwork,
  personId: string,
): RelationshipNetwork {
  return {
    people: network.people.filter((person) => person.id !== personId),
    relationships: network.relationships.filter(
      (relationship) =>
        relationship.sourcePersonId !== personId && relationship.targetPersonId !== personId,
    ),
  }
}

export function removeRelationshipFromNetwork(
  network: RelationshipNetwork,
  relationshipId: string,
): RelationshipNetwork {
  const relationship = network.relationships.find((item) => item.id === relationshipId)
  const idsToRemove = new Set([relationshipId, relationship?.inverseRelationshipId])
  return {
    ...network,
    relationships: network.relationships.filter(
      (item) => !idsToRemove.has(item.id) && item.inverseRelationshipId !== relationshipId,
    ),
  }
}
