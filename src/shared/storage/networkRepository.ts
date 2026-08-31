import type { RelationshipNetwork } from '../../domain/network'
import { GENDERS } from '../../domain/person'
import { RELATIONSHIP_TYPES } from '../../domain/relationship'

const STORAGE_KEY = 'relationship-network:v1'
const EMPTY_NETWORK: RelationshipNetwork = { people: [], relationships: [] }

export function loadNetwork(): RelationshipNetwork {
  if (typeof window === 'undefined') return EMPTY_NETWORK

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return EMPTY_NETWORK
    return sanitizeNetwork(JSON.parse(stored) as unknown)
  } catch {
    return EMPTY_NETWORK
  }
}

export function saveNetwork(network: RelationshipNetwork) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(network))
}

function sanitizeNetwork(value: unknown): RelationshipNetwork {
  if (!value || typeof value !== 'object') return EMPTY_NETWORK
  const candidate = value as Partial<RelationshipNetwork>
  const people = Array.isArray(candidate.people)
    ? candidate.people.filter(
        (person) =>
          person &&
          typeof person.id === 'string' &&
          typeof person.name === 'string' &&
          GENDERS.includes(person.gender),
      )
    : []
  const personIds = new Set(people.map((person) => person.id))
  const relationships = Array.isArray(candidate.relationships)
    ? candidate.relationships.filter(
        (relationship) =>
          relationship &&
          typeof relationship.id === 'string' &&
          personIds.has(relationship.sourcePersonId) &&
          personIds.has(relationship.targetPersonId) &&
          relationship.sourcePersonId !== relationship.targetPersonId &&
          RELATIONSHIP_TYPES.includes(relationship.type),
      )
    : []

  return { people, relationships }
}

