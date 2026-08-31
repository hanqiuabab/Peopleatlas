import { describe, expect, it } from 'vitest'
import type { Person } from '../../domain/person'
import { getRelationshipOptions } from './relationshipOptions'

const people: Person[] = [
  { id: 'a', name: 'A', gender: 'male', createdAt: '', updatedAt: '' },
  { id: 'b', name: 'B', gender: 'female', createdAt: '', updatedAt: '' },
  { id: 'c', name: 'C', gender: 'male', createdAt: '', updatedAt: '' },
  { id: 'd', name: 'D', gender: 'female', createdAt: '', updatedAt: '' },
]

describe('relationship form options', () => {
  it('uses the selected IDs, not the order of people', () => {
    expect(getRelationshipOptions(people, 'b', 'a')).toEqual([
      'mother', 'wife', 'daughter', 'older_sister', 'younger_sister', 'colleague',
    ])
  })

  it('updates spouse availability when only B changes', () => {
    expect(getRelationshipOptions(people, 'a', 'b')).toContain('husband')
    expect(getRelationshipOptions(people, 'a', 'c')).not.toContain('husband')
    expect(getRelationshipOptions(people, 'b', 'a')).toContain('wife')
    expect(getRelationshipOptions(people, 'b', 'd')).not.toContain('wife')
  })

  it('uses current genders after people are edited', () => {
    const updated = people.map((person) => person.id === 'b' ? { ...person, gender: 'male' as const } : person)
    expect(getRelationshipOptions(updated, 'b', 'a')).toEqual([
      'father', 'son', 'older_brother', 'younger_brother', 'colleague',
    ])
  })

  it.each([['a', 'a'], ['missing', 'b'], ['a', 'missing'], ['', ''], ['a', '']])(
    'has no options for an invalid pair %s / %s', (source, target) => {
      expect(getRelationshipOptions(people, source, target)).toEqual([])
    },
  )

  it('handles an empty network', () => {
    expect(getRelationshipOptions([], '', '')).toEqual([])
  })
})
