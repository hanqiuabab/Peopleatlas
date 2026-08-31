import { describe, expect, it } from 'vitest'
import {
  getInverseRelationshipType,
  getAvailableRelationshipTypes,
  isRelationshipGenderCompatible,
  isDirectedRelationship,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
} from './relationship'
import { GENDERS } from './person'

describe('relationship types', () => {
  it('contains the four sibling relationships with their Chinese labels', () => {
    expect(RELATIONSHIP_TYPES).toEqual(expect.arrayContaining([
      'older_brother',
      'older_sister',
      'younger_brother',
      'younger_sister',
    ]))
    expect(RELATIONSHIP_LABELS.older_brother).toBe('哥哥')
    expect(RELATIONSHIP_LABELS.older_sister).toBe('姐姐')
    expect(RELATIONSHIP_LABELS.younger_brother).toBe('弟弟')
    expect(RELATIONSHIP_LABELS.younger_sister).toBe('妹妹')
  })

  it('renders sibling relationships as directed relationships', () => {
    expect(isDirectedRelationship('older_brother')).toBe(true)
    expect(isDirectedRelationship('older_sister')).toBe(true)
    expect(isDirectedRelationship('younger_brother')).toBe(true)
    expect(isDirectedRelationship('younger_sister')).toBe(true)
  })

  it('derives reverse relationship types from the reverse source gender', () => {
    expect(getInverseRelationshipType('son', 'male')).toBe('father')
    expect(getInverseRelationshipType('daughter', 'female')).toBe('mother')
    expect(getInverseRelationshipType('father', 'female')).toBe('daughter')
    expect(getInverseRelationshipType('older_sister', 'male')).toBe('younger_brother')
    expect(getInverseRelationshipType('younger_brother', 'female')).toBe('older_sister')
    expect(getInverseRelationshipType('husband', 'female')).toBe('wife')
    expect(getInverseRelationshipType('colleague', 'male')).toBe('colleague')
  })
})

describe('gender-compatible relationship choices', () => {
  it('shows male titles without spouse choices for two men', () => {
    expect(getAvailableRelationshipTypes('male', 'male')).toEqual([
      'father', 'son', 'older_brother', 'younger_brother', 'colleague',
    ])
  })

  it('includes husband for a male source and female target', () => {
    expect(getAvailableRelationshipTypes('male', 'female')).toEqual([
      'father', 'husband', 'son', 'older_brother', 'younger_brother', 'colleague',
    ])
  })

  it('includes wife for a female source and male target', () => {
    expect(getAvailableRelationshipTypes('female', 'male')).toEqual([
      'mother', 'wife', 'daughter', 'older_sister', 'younger_sister', 'colleague',
    ])
  })

  it('shows female titles without spouse choices for two women', () => {
    expect(getAvailableRelationshipTypes('female', 'female')).toEqual([
      'mother', 'daughter', 'older_sister', 'younger_sister', 'colleague',
    ])
  })

  it('all allowed options have a gender-compatible inverse and preserve their meaning after reversing twice', () => {
    for (const sourceGender of GENDERS) {
      for (const targetGender of GENDERS) {
        for (const type of getAvailableRelationshipTypes(sourceGender, targetGender)) {
          const inverse = getInverseRelationshipType(type, targetGender)
          expect(isRelationshipGenderCompatible(inverse, targetGender, sourceGender)).toBe(true)
          expect(getInverseRelationshipType(inverse, sourceGender)).toBe(type)
        }
      }
    }
  })
})
