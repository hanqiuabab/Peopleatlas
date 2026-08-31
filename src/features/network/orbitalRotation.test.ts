import { describe, expect, it } from 'vitest'
import { isOrbitalRotationPaused } from './orbitalRotation'

describe('orbital rotation state', () => {
  it('pauses while a person or relationship is selected', () => {
    expect(isOrbitalRotationPaused({
      isManuallyPaused: false,
      isDragging: false,
      selectedPersonId: 'person-1',
    })).toBe(true)

    expect(isOrbitalRotationPaused({
      isManuallyPaused: false,
      isDragging: false,
      selectedRelationshipId: 'relationship-1',
    })).toBe(true)
  })

  it('rotates when the selection is cleared', () => {
    expect(isOrbitalRotationPaused({
      isManuallyPaused: false,
      isDragging: false,
    })).toBe(false)
  })

  it('still pauses for manual controls and dragging', () => {
    expect(isOrbitalRotationPaused({
      isManuallyPaused: true,
      isDragging: false,
    })).toBe(true)
    expect(isOrbitalRotationPaused({
      isManuallyPaused: false,
      isDragging: true,
    })).toBe(true)
  })
})
