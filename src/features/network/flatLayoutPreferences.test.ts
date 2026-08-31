import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadFlatLayoutMode, saveFlatLayoutMode, type FlatLayoutMode } from './flatLayoutPreferences'

function mockStorage(initial?: string) {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set('relationship-network:flat-layout:v1', initial)
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
  vi.stubGlobal('window', { localStorage: storage })
  return { values, storage }
}

afterEach(() => vi.unstubAllGlobals())

describe('flat layout preference', () => {
  it('defaults to ring on the first visit', () => {
    mockStorage()
    expect(loadFlatLayoutMode()).toBe('ring')
  })

  it.each<FlatLayoutMode>(['hierarchy', 'free', 'ring'])('restores %s on a new initialization', (mode) => {
    mockStorage()
    saveFlatLayoutMode(mode)
    expect(loadFlatLayoutMode()).toBe(mode)
    expect(loadFlatLayoutMode()).toBe(mode)
  })

  it('keeps the last explicit choice without overwriting network data', () => {
    const { values } = mockStorage()
    const network = '{"people":[],"relationships":[]}'
    values.set('relationship-network:v1', network)
    saveFlatLayoutMode('hierarchy')
    saveFlatLayoutMode('free')
    saveFlatLayoutMode('ring')
    saveFlatLayoutMode('hierarchy')
    expect(loadFlatLayoutMode()).toBe('hierarchy')
    expect(values.get('relationship-network:v1')).toBe(network)
  })

  it.each(['', 'unknown', 'null', '{}', '"hierarchy"'])('ignores invalid saved values: %s', (value) => {
    mockStorage(value)
    expect(loadFlatLayoutMode()).toBe('ring')
  })

  it('does not crash without a browser', () => {
    vi.stubGlobal('window', undefined)
    expect(loadFlatLayoutMode()).toBe('ring')
    expect(() => saveFlatLayoutMode('hierarchy')).not.toThrow()
  })

  it('tolerates blocked storage access', () => {
    vi.stubGlobal('window', {
      get localStorage(): never { throw new Error('Storage access denied') },
    })
    expect(loadFlatLayoutMode()).toBe('ring')
    expect(() => saveFlatLayoutMode('hierarchy')).not.toThrow()
  })

  it('tolerates read failures and a full preference store', () => {
    const { storage } = mockStorage()
    storage.getItem.mockImplementation(() => { throw new Error('Read failed') })
    storage.setItem.mockImplementation(() => { throw new Error('Quota exceeded') })
    expect(loadFlatLayoutMode()).toBe('ring')
    expect(() => saveFlatLayoutMode('hierarchy')).not.toThrow()
  })
})
