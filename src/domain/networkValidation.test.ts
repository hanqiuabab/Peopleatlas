import { describe, expect, it } from 'vitest'
import { GENDERS, type Person } from './person'
import { RELATIONSHIP_TYPES, getAvailableRelationshipTypes, type Relationship } from './relationship'
import { validatePersonInput, validateRelationshipInput } from './networkValidation'

const people: Person[] = [
  { id: 'p1', name: '林海', gender: 'male', createdAt: '', updatedAt: '' },
  { id: 'p2', name: '林晓', gender: 'female', createdAt: '', updatedAt: '' },
]

const relationships: Relationship[] = [
  {
    id: 'r1',
    sourcePersonId: 'p1',
    targetPersonId: 'p2',
    type: 'father',
    createdAt: '',
    updatedAt: '',
  },
]

describe('validatePersonInput', () => {
  it('accepts a trimmed non-empty name and supported gender', () => {
    expect(validatePersonInput({ name: ' 林晓 ', gender: 'female' })).toBeNull()
  })

  it('rejects an empty name', () => {
    expect(validatePersonInput({ name: '   ', gender: 'male' })).toBe('请输入人物姓名')
  })

  it('rejects a name longer than 30 characters', () => {
    expect(validatePersonInput({ name: '人'.repeat(31), gender: 'male' })).toBe(
      '人物姓名不能超过 30 个字符',
    )
  })
})

describe('validateRelationshipInput', () => {
  it('enforces the same gender rules as the options for every gender pair and relationship type', () => {
    for (const sourceGender of GENDERS) {
      for (const targetGender of GENDERS) {
        const pair: Person[] = [
          { ...people[0], gender: sourceGender },
          { ...people[1], gender: targetGender },
        ]
        const allowed = getAvailableRelationshipTypes(sourceGender, targetGender)
        for (const type of RELATIONSHIP_TYPES) {
          const error = validateRelationshipInput({ sourcePersonId: 'p1', targetPersonId: 'p2', type }, pair, [])
          expect(error).toBe(allowed.includes(type) ? null : '关系类型与人物性别不匹配，请重新选择关系')
        }
      }
    }
  })

  it('accepts a valid relationship', () => {
    expect(
      validateRelationshipInput(
        { sourcePersonId: 'p2', targetPersonId: 'p1', type: 'daughter' },
        people,
        relationships,
      ),
    ).toBeNull()
  })

  it('rejects a self relationship', () => {
    expect(
      validateRelationshipInput(
        { sourcePersonId: 'p1', targetPersonId: 'p1', type: 'colleague' },
        people,
        relationships,
      ),
    ).toBe('不能为同一个人物添加自身关系')
  })

  it('rejects a missing person reference', () => {
    expect(
      validateRelationshipInput(
        { sourcePersonId: 'missing', targetPersonId: 'p1', type: 'son' },
        people,
        relationships,
      ),
    ).toBe('请选择有效的起点人物')
  })

  it('rejects a duplicated source-target-type combination', () => {
    expect(
      validateRelationshipInput(
        { sourcePersonId: 'p1', targetPersonId: 'p2', type: 'father' },
        people,
        relationships,
      ),
    ).toBe('这条人物关系已经存在')
  })

  it('allows an unchanged relationship while editing itself', () => {
    expect(
      validateRelationshipInput(
        { sourcePersonId: 'p1', targetPersonId: 'p2', type: 'father' },
        people,
        relationships,
        'r1',
      ),
    ).toBeNull()
  })
})
