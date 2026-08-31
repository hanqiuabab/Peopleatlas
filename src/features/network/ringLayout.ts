import type { GraphPoint } from './graphConnection'

export function getRingGeometry(width: number, height: number) {
  // Leave room for filters/selection above and the two-row controls below.
  const top = Math.min(195, height / 2)
  const bottom = Math.max(top, height - 130)
  return {
    center: { x: width / 2, y: (top + bottom) / 2 },
    radius: Math.max(0, Math.min((width - 140) / 2, (bottom - top) / 2)),
  }
}

export function buildRingPositions(
  personIds: string[],
  width: number,
  height: number,
  rotation = 0,
): Record<string, GraphPoint> {
  const { center, radius } = getRingGeometry(width, height)
  return Object.fromEntries(personIds.map((id, index) => {
    if (personIds.length === 1) return [id, { ...center }]
    const angle = rotation - Math.PI / 2 + index * Math.PI * 2 / personIds.length
    return [id, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    }]
  }))
}
