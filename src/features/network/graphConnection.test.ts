import { describe, expect, it } from 'vitest'
import { findConnectionTarget } from './graphConnection'

const positions = {
  source: { x: 100, y: 100 },
  targetA: { x: 220, y: 100 },
  targetB: { x: 230, y: 120 },
}

describe('findConnectionTarget', () => {
  it('returns the nearest person inside the hit radius', () => {
    expect(findConnectionTarget('source', { x: 225, y: 108 }, positions)).toBe('targetA')
  })

  it('never targets the source person itself', () => {
    expect(findConnectionTarget('source', { x: 100, y: 100 }, positions)).toBeUndefined()
  })

  it('returns no target when the pointer is outside every node', () => {
    expect(findConnectionTarget('source', { x: 400, y: 400 }, positions)).toBeUndefined()
  })
})

