import { GENDERS, type Gender, type Person } from './person'
import {
  RELATIONSHIP_TYPES,
  isRelationshipGenderCompatible,
  type Relationship,
  type RelationshipType,
} from './relationship'

export interface PersonInput {
  name: string
  gender: Gender
}

export interface RelationshipInput {
  sourcePersonId: string
  targetPersonId: string
  type: RelationshipType
}

export function validatePersonInput(input: PersonInput): string | null {
  if (!input.name.trim()) return '请输入人物姓名'
  if (input.name.trim().length > 30) return '人物姓名不能超过 30 个字符'
  if (!GENDERS.includes(input.gender)) return '请选择有效的性别'
  return null
}

export function validateRelationshipInput(
  input: RelationshipInput,
  people: Person[],
  relationships: Relationship[],
  editingIds?: string | string[],
): string | null {
  const source = people.find((person) => person.id === input.sourcePersonId)
  const target = people.find((person) => person.id === input.targetPersonId)
  if (!source) {
    return '请选择有效的起点人物'
  }
  if (!target) {
    return '请选择有效的终点人物'
  }
  if (input.sourcePersonId === input.targetPersonId) {
    return '不能为同一个人物添加自身关系'
  }
  if (!RELATIONSHIP_TYPES.includes(input.type)) {
    return '请选择有效的关系类型'
  }
  if (!isRelationshipGenderCompatible(input.type, source.gender, target.gender)) {
    return '关系类型与人物性别不匹配，请重新选择关系'
  }
  const ignoredIds = new Set(
    typeof editingIds === 'string' ? [editingIds] : editingIds ?? [],
  )
  const duplicated = relationships.some(
    (relationship) =>
      !ignoredIds.has(relationship.id) &&
      relationship.sourcePersonId === input.sourcePersonId &&
      relationship.targetPersonId === input.targetPersonId &&
      relationship.type === input.type,
  )
  if (duplicated) return '这条人物关系已经存在'
  return null
}
