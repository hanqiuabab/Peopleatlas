export type FlatLayoutMode = 'free' | 'hierarchy' | 'ring'

const STORAGE_KEY = 'relationship-network:flat-layout:v1'

export function loadFlatLayoutMode(): FlatLayoutMode {
  try {
    if (typeof window === 'undefined') return 'ring'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'free' || stored === 'hierarchy' || stored === 'ring' ? stored : 'ring'
  } catch {
    return 'ring'
  }
}

export function saveFlatLayoutMode(mode: FlatLayoutMode): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // A blocked or full preference store must not prevent in-memory layout changes.
  }
}
