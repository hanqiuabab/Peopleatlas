import type { Person } from '../../domain/person'
import { RELATIONSHIP_LABELS, type Relationship } from '../../domain/relationship'

export function getRelationshipSentence(relationship: Relationship, people: Person[]) {
  const source = people.find((person) => person.id === relationship.sourcePersonId)?.name ?? '未知人物'
  const target = people.find((person) => person.id === relationship.targetPersonId)?.name ?? '未知人物'
  const label = RELATIONSHIP_LABELS[relationship.type]
  return relationship.type === 'colleague'
    ? `${source} 与 ${target} 是同事`
    : `${source} 是 ${target} 的${label}`
}

