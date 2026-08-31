import { useCallback, useEffect, useState, type RefObject } from 'react'

function getCanvasPanel(container: HTMLElement | null) {
  return container?.closest<HTMLElement>('.canvas-panel') ?? null
}

export function useGraphFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string>()

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === getCanvasPanel(containerRef.current))
    }
    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [containerRef])

  const toggleFullscreen = useCallback(async () => {
    const canvasPanel = getCanvasPanel(containerRef.current)
    setFullscreenError(undefined)

    if (!canvasPanel || !document.fullscreenEnabled) {
      setFullscreenError('当前浏览器不支持全屏显示。')
      return
    }

    try {
      if (document.fullscreenElement === canvasPanel) {
        await document.exitFullscreen()
      } else {
        if (document.fullscreenElement) await document.exitFullscreen()
        await canvasPanel.requestFullscreen()
      }
    } catch {
      setFullscreenError('无法进入全屏，请检查浏览器权限后重试。')
    }
  }, [containerRef])

  return { isFullscreen, fullscreenError, toggleFullscreen }
}

