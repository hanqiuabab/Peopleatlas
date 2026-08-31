import { useEffect, useState } from 'react'
import { isOrbitalRotationPaused as isRotationPaused } from './orbitalRotation'

interface RingRotationOptions {
  active: boolean
  personCount: number
  isInteracting: boolean
  selectedPersonId?: string
  selectedRelationshipId?: string
}

export function useRingRotation({
  active,
  personCount,
  isInteracting,
  selectedPersonId,
  selectedRelationshipId,
}: RingRotationOptions) {
  const [rotation, setRotation] = useState(0)
  const [isManuallyPaused, setIsManuallyPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const isPaused = personCount < 2 || isRotationPaused({
    isManuallyPaused,
    isDragging: isInteracting,
    selectedPersonId,
    selectedRelationshipId,
  })

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => { if (preference.matches) setIsManuallyPaused(true) }
    preference.addEventListener('change', onChange)
    return () => preference.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!active || isPaused) return
    let frameId = 0
    let previousTime: number | undefined
    const animate = (time: number) => {
      const delta = Math.min(time - (previousTime ?? time), 40)
      previousTime = time
      setRotation((current) => (current + delta * 0.0001) % (Math.PI * 2))
      frameId = window.requestAnimationFrame(animate)
    }
    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [active, isPaused])

  return {
    rotation,
    isPaused,
    togglePause: () => setIsManuallyPaused((current) => !current),
    resetRotation: () => {
      setRotation(0)
      setIsManuallyPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    },
  }
}
