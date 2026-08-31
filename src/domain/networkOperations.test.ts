import { describe, expect, it } from 'vitest'
import type { RelationshipNetwork } from './network'
import {
  addRelationshipPairToNetwork,
  ensureInverseRelationships,
  removePersonFromNetwork,
  removeRelationshipFromNetwork,
  updateRelationshipPairInNetwork,
} from './networkOperations'

const network: RelationshipNetwork = {
  people: [
    { id: 'p1', name: '林海', gender: 'male', createdAt: '', updatedAt: '' },
    { id: 'p2', name: '林晓', gender: 'female', createdAt: '', updatedAt: '' },
    { id: 'p3', name: '周宁', gender: 'male', createdAt: '', updatedAt: '' },
  ],
  relationships: [
    { id: 'r1', sourcePersonId: 'p1', targetPersonId: 'p2', type: 'father', createdAt: '', updatedAt: '' },
    { id: 'r2', sourcePersonId: 'p2', targetPersonId: 'p3', type: 'colleague', createdAt: '', updatedAt: '' },
  ],
}

describe('network deletion operations', () => {
  it('removes a person and every relationship connected to that person', () => {
    const result = removePersonFromNetwork(network, 'p2')
    expect(result.people.map((person) => person.id)).toEqual(['p1', 'p3'])
    expect(result.relationships).toEqual([])
  })

  it('removes only the requested relationship', () => {
    const result = removeRelationshipFromNetwork(network, 'r1')
    expect(result.people).toEqual(network.people)
    expect(result.relationships.map((relationship) => relationship.id)).toEqual(['r2'])
  })

  it('removes a relationship and its linked inverse relationship together', () => {
    const paired = addRelationshipPairToNetwork(
      { people: network.people, relationships: [] },
      { sourcePersonId: 'p1', targetPersonId: 'p3', type: 'son' },
      (() => {
        const ids = ['forward', 'reverse']
        return () => ids.shift() ?? 'unexpected'
      })(),
      'now',
    ).network

    expect(removeRelationshipFromNetwork(paired, 'forward').relationships).toEqual([])
  })
})

describe('inverse relationship operations', () => {
  it('deletes from the inverse side without removing people or another relationship between them', () => {
    let nextId = 0
    const createId = () => `pair-${nextId++}`
    const family = addRelationshipPairToNetwork(
      { people: network.people, relationships: [] },
      { sourcePersonId: 'p1', targetPersonId: 'p2', type: 'father' }, createId, 'now',
    )
    const colleagues = addRelationshipPairToNetwork(
      family.network,
      { sourcePersonId: 'p1', targetPersonId: 'p2', type: 'colleague' }, createId, 'now',
    )
    const result = removeRelationshipFromNetwork(colleagues.network, family.relationship.inverseRelationshipId!)
    expect(result.people).toEqual(network.people)
    expect(result.relationships).toHaveLength(2)
    expect(result.relationships.every((item) => item.type === 'colleague')).toBe(true)
    expect(colleagues.network.relationships).toHaveLength(4)
  })

  it('adds a gender-aware inverse relationship', () => {
    const result = addRelationshipPairToNetwork(
      { people: network.people, relationships: [] },
      { sourcePersonId: 'p1', targetPersonId: 'p3', type: 'son' },
      (() => {
        const ids = ['forward', 'reverse']
        return () => ids.shift() ?? 'unexpected'
      })(),
      'now',
    )

    expect(result.relationship).toMatchObject({
      id: 'forward',
      inverseRelationshipId: 'reverse',
      sourcePersonId: 'p1',
      targetPersonId: 'p3',
      type: 'son',
    })
    expect(result.network.relationships[1]).toMatchObject({
      id: 'reverse',
      inverseRelationshipId: 'forward',
      sourcePersonId: 'p3',
      targetPersonId: 'p1',
      type: 'father',
    })
  })

  it('updates both directions of a relationship pair', () => {
    const paired = addRelationshipPairToNetwork(
      { people: network.people, relationships: [] },
      { sourcePersonId: 'p1', targetPersonId: 'p3', type: 'son' },
      (() => {
        const ids = ['forward', 'reverse']
        return () => ids.shift() ?? 'unexpected'
      })(),
      'created',
    ).network
    const result = updateRelationshipPairInNetwork(
      paired,
      'forward',
      { sourcePersonId: 'p1', targetPersonId: 'p2', type: 'colleague' },
      () => 'unused',
      'updated',
    )

    expect(result.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'forward', sourcePersonId: 'p1', targetPersonId: 'p2', type: 'colleague' }),
      expect.objectContaining({ id: 'reverse', sourcePersonId: 'p2', targetPersonId: 'p1', type: 'colleague' }),
    ]))
  })

  it('migrates a legacy one-way relationship without duplicating an existing reverse', () => {
    const generatedIds = ['generated-father', 'generated-colleague']
    const legacy = ensureInverseRelationships(
      network,
      () => generatedIds.shift() ?? 'unexpected',
      'now',
    )

    expect(legacy.relationships).toHaveLength(4)
    expect(legacy.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePersonId: 'p2', targetPersonId: 'p1', type: 'daughter' }),
      expect.objectContaining({ sourcePersonId: 'p3', targetPersonId: 'p2', type: 'colleague' }),
    ]))

    const remigrated = ensureInverseRelationships(legacy, () => 'should-not-be-used', 'later')
    expect(remigrated.relationships).toHaveLength(4)
  })
})
