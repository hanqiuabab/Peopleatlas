export interface OrbitalRotationState {
  isManuallyPaused: boolean
  isDragging: boolean
  selectedPersonId?: string
  selectedRelationshipId?: string
}

export function isOrbitalRotationPaused({
  isManuallyPaused,
  isDragging,
  selectedPersonId,
  selectedRelationshipId,
}: OrbitalRotationState) {
  return isManuallyPaused
    || isDragging
    || Boolean(selectedPersonId)
    || Boolean(selectedRelationshipId)
}
