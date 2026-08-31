import { useCallback, useState } from 'react'
import { loadFlatLayoutMode, saveFlatLayoutMode, type FlatLayoutMode } from './flatLayoutPreferences'

export function useFlatLayoutMode() {
  const [mode, setMode] = useState(loadFlatLayoutMode)
  const changeMode = useCallback((next: FlatLayoutMode) => {
    setMode(next)
    saveFlatLayoutMode(next)
  }, [])

  return [mode, changeMode] as const
}
