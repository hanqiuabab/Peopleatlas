import type { Person } from './person'
import type { Relationship } from './relationship'

export interface RelationshipNetwork {
  people: Person[]
  relationships: Relationship[]
}

