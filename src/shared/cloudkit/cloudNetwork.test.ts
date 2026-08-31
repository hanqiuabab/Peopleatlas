import { describe, expect, it } from 'vitest'
import type { RelationshipNetwork } from '../../domain/network'
import { mergeNetworks, networkFingerprint } from './cloudNetwork'

const local: RelationshipNetwork = {
  people: [
    { id: 'a', name: '本地 A', gender: 'male', createdAt: '2026-01-01', updatedAt: '2026-01-03' },
    { id: 'b', name: '本地 B', gender: 'female', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ],
  relationships: [],
}

describe('cloud network reconciliation', () => {
  it('keeps the newest same-id item and preserves unique items from both sides', () => {
    const cloud: RelationshipNetwork = {
      people: [
        { id: 'a', name: '云端旧 A', gender: 'male', createdAt: '2026-01-01', updatedAt: '2026-01-02' },
        { id: 'c', name: '云端 C', gender: 'female', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
      ],
      relationships: [{
        id: 'r', sourcePersonId: 'a', targetPersonId: 'c', type: 'colleague',
        createdAt: '2026-01-02', updatedAt: '2026-01-02',
      }],
    }

    const merged = mergeNetworks(local, cloud)
    expect(merged.people.map((person) => person.id)).toEqual(['a', 'b', 'c'])
    expect(merged.people.find((person) => person.id === 'a')?.name).toBe('本地 A')
    expect(merged.relationships).toHaveLength(1)
  })

  it('drops cloud relationships whose people are absent after validation', () => {
    const merged = mergeNetworks(local, {
      people: [],
      relationships: [{
        id: 'broken', sourcePersonId: 'missing', targetPersonId: 'a', type: 'colleague',
        createdAt: '2026-01-02', updatedAt: '2026-01-02',
      }],
    })
    expect(merged.relationships).toEqual([])
  })

  it('uses a stable serialized fingerprint for unchanged snapshots', () => {
    expect(networkFingerprint(local)).toBe(networkFingerprint(structuredClone(local)))
  })
})
