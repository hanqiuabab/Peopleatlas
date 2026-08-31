import type { Gender } from './person'

export const RELATIONSHIP_TYPES = [
  'father',
  'mother',
  'husband',
  'wife',
  'son',
  'daughter',
  'older_brother',
  'older_sister',
  'younger_brother',
  'younger_sister',
  'colleague',
] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  father: '父亲',
  mother: '母亲',
  husband: '丈夫',
  wife: '妻子',
  son: '儿子',
  daughter: '女儿',
  older_brother: '哥哥',
  older_sister: '姐姐',
  younger_brother: '弟弟',
  younger_sister: '妹妹',
  colleague: '同事',
}

const RELATIONSHIP_SOURCE_GENDERS: Record<RelationshipType, Gender | null> = {
  father: 'male',
  mother: 'female',
  husband: 'male',
  wife: 'female',
  son: 'male',
  daughter: 'female',
  older_brother: 'male',
  older_sister: 'female',
  younger_brother: 'male',
  younger_sister: 'female',
  colleague: null,
}

export function isRelationshipGenderCompatible(
  type: RelationshipType,
  sourceGender: Gender,
  targetGender: Gender,
): boolean {
  const sourceRequirement = RELATIONSHIP_SOURCE_GENDERS[type]
  const inverseType = getInverseRelationshipType(type, targetGender)
  const targetRequirement = RELATIONSHIP_SOURCE_GENDERS[inverseType]
  return (sourceRequirement === null || sourceRequirement === sourceGender)
    && (targetRequirement === null || targetRequirement === targetGender)
}

export function getAvailableRelationshipTypes(sourceGender: Gender, targetGender: Gender): RelationshipType[] {
  return RELATIONSHIP_TYPES.filter((type) => isRelationshipGenderCompatible(type, sourceGender, targetGender))
}

export function getInverseRelationshipType(
  type: RelationshipType,
  reverseSourceGender: Gender,
): RelationshipType {
  switch (type) {
    case 'father':
    case 'mother':
      return reverseSourceGender === 'male' ? 'son' : 'daughter'
    case 'son':
    case 'daughter':
      return reverseSourceGender === 'male' ? 'father' : 'mother'
    case 'husband':
      return 'wife'
    case 'wife':
      return 'husband'
    case 'older_brother':
    case 'older_sister':
      return reverseSourceGender === 'male' ? 'younger_brother' : 'younger_sister'
    case 'younger_brother':
    case 'younger_sister':
      return reverseSourceGender === 'male' ? 'older_brother' : 'older_sister'
    case 'colleague':
      return 'colleague'
  }
}

export function isDirectedRelationship(type: RelationshipType) {
  return type !== 'colleague'
}

export interface Relationship {
  id: string
  inverseRelationshipId?: string
  sourcePersonId: string
  targetPersonId: string
  type: RelationshipType
  createdAt: string
  updatedAt: string
}
