import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCloudSyncFingerprint, saveCloudSyncFingerprint } from './cloudSyncMetadata'

afterEach(() => vi.unstubAllGlobals())

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('CloudKit sync metadata', () => {
  it('keeps the last synchronized fingerprint isolated by Apple user record', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() })
    saveCloudSyncFingerprint('user-a', 'fingerprint-a')
    saveCloudSyncFingerprint('user-b', 'fingerprint-b')
    expect(loadCloudSyncFingerprint('user-a')).toBe('fingerprint-a')
    expect(loadCloudSyncFingerprint('user-b')).toBe('fingerprint-b')
  })

  it('degrades safely when browser storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => { throw new Error('denied') }, setItem: () => undefined },
    })
    expect(loadCloudSyncFingerprint('user')).toBeUndefined()
    expect(() => saveCloudSyncFingerprint('user', 'fingerprint')).not.toThrow()
  })
})
