const STORAGE_KEY = 'relationship-network:cloud-sync:v1'

interface CloudSyncMetadata {
  fingerprint: string
}

type MetadataByUser = Record<string, CloudSyncMetadata>

function readAll(): MetadataByUser {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown
    if (!value || typeof value !== 'object') return {}
    return value as MetadataByUser
  } catch {
    return {}
  }
}

export function loadCloudSyncFingerprint(userRecordName: string): string | undefined {
  const metadata = readAll()[userRecordName]
  return typeof metadata?.fingerprint === 'string' ? metadata.fingerprint : undefined
}

export function saveCloudSyncFingerprint(userRecordName: string, fingerprint: string): void {
  try {
    const all = readAll()
    all[userRecordName] = { fingerprint }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // iCloud sync still works in this session when localStorage is unavailable.
  }
}
