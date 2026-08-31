export interface GraphPoint {
  x: number
  y: number
}

export function findConnectionTarget(
  sourcePersonId: string,
  pointer: GraphPoint,
  positions: Record<string, GraphPoint>,
  hitRadius = 54,
) {
  let nearestId: string | undefined
  let nearestDistance = hitRadius

  Object.entries(positions).forEach(([personId, position]) => {
    if (personId === sourcePersonId) return
    const distance = Math.hypot(pointer.x - position.x, pointer.y - position.y)
    if (distance <= nearestDistance) {
      nearestId = personId
      nearestDistance = distance
    }
  })

  return nearestId
}

