import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RelationshipNetwork } from '../../domain/network'
import {
  createCloudKitClientFromNamespace,
  extractCloudKitWebAuthToken,
  type CloudKitDatabase,
  type CloudKitNamespace,
  type CloudKitRecord,
} from './cloudKitClient'

const network: RelationshipNetwork = {
  people: [{
    id: 'a', name: '测试', gender: 'male', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  }],
  relationships: [],
}

afterEach(() => vi.unstubAllGlobals())

function namespace(database: CloudKitDatabase, configure = vi.fn()): CloudKitNamespace {
  return {
    DEVELOPMENT_ENVIRONMENT: 'development-value',
    PRODUCTION_ENVIRONMENT: 'production-value',
    configure,
    getDefaultContainer: () => ({
      privateCloudDatabase: database,
      setUpAuth: async () => ({ userRecordName: 'user' }),
      whenUserSignsIn: () => new Promise(() => undefined),
      whenUserSignsOut: () => new Promise(() => undefined),
    }),
  }
}

describe('CloudKit network client', () => {
  it('extracts the web auth token from an Apple redirect URL', () => {
    expect(extractCloudKitWebAuthToken(
      'https://example.com/app/?ckWebAuthToken=session-token&ckSession=duplicate',
    )).toBe('session-token')
    expect(extractCloudKitWebAuthToken('https://example.com/app/')).toBeUndefined()
  })

  it('treats a missing private record as an empty cloud store', async () => {
    vi.stubGlobal('window', { fetch: vi.fn() })
    const database: CloudKitDatabase = {
      fetchRecords: async () => ({
        records: [], hasErrors: true, errors: [{ serverErrorCode: 'NOT_FOUND' }],
      }),
      saveRecords: async () => ({ records: [] }),
    }
    const client = createCloudKitClientFromNamespace(namespace(database), {
      containerIdentifier: 'iCloud.example', apiToken: 'token', environment: 'development',
    })
    await expect(client.fetchNetwork()).resolves.toBeNull()
  })

  it('saves and decodes a private network snapshot with its change tag', async () => {
    vi.stubGlobal('window', { fetch: vi.fn() })
    let received: CloudKitRecord | undefined
    const database: CloudKitDatabase = {
      fetchRecords: async () => ({ records: [] }),
      saveRecords: async (record) => {
        received = Array.isArray(record) ? record[0] : record
        return { records: [{ ...received, recordChangeTag: 'tag-1' }] }
      },
    }
    const configure = vi.fn()
    const client = createCloudKitClientFromNamespace(namespace(database, configure), {
      containerIdentifier: 'iCloud.example', apiToken: 'token', environment: 'production',
    })

    const saved = await client.saveNetwork(network)
    expect(saved.network).toEqual(network)
    expect(saved.changeTag).toBe('tag-1')
    expect(received?.recordType).toBe('PeopleAtlasWebNetwork')
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ containers: [expect.objectContaining({
      environment: 'production-value',
    })] }))
  })
})
