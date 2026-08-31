import type { Relationship } from '../../domain/relationship'
import { relaxRelationshipLayout } from './relationshipLayout'

export interface SpherePoint {
  x: number
  y: number
  z: number
}

export interface ProjectedSpherePoint {
  x: number
  y: number
  depth: number
  scale: number
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export function buildSphereLayout(ids: string[], relationships: Relationship[] = []): Record<string, SpherePoint> {
  if (ids.length === 1) return { [ids[0]]: { x: 0, y: 0, z: 0 } }

  const orderedIds = [...ids].sort()
  const initial = Object.fromEntries(orderedIds.map((id, index) => {
    const y = 1 - ((index + 0.5) / ids.length) * 2
    const horizontalRadius = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = GOLDEN_ANGLE * index + hashAngle(id)
    return [id, {
      x: Math.cos(angle) * horizontalRadius,
      y,
      z: Math.sin(angle) * horizontalRadius,
    }]
  }))
  return relaxRelationshipLayout(initial, relationships, 'sphere')
}

export function projectSpherePoint(
  point: SpherePoint,
  rotation: number,
  radius: number,
  centerX: number,
  centerY: number,
): ProjectedSpherePoint {
  const cosRotation = Math.cos(rotation)
  const sinRotation = Math.sin(rotation)
  const rotatedX = point.x * cosRotation + point.z * sinRotation
  const rotatedZ = -point.x * sinRotation + point.z * cosRotation
  const tilt = -0.18
  const cosTilt = Math.cos(tilt)
  const sinTilt = Math.sin(tilt)
  const tiltedY = point.y * cosTilt - rotatedZ * sinTilt
  const depth = point.y * sinTilt + rotatedZ * cosTilt
  const perspective = 1 + depth * 0.12

  return {
    x: centerX + rotatedX * radius * perspective,
    y: centerY + tiltedY * radius * perspective,
    depth,
    scale: 0.72 + ((depth + 1) / 2) * 0.56,
  }
}

function hashAngle(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return ((hash % 360) / 360) * Math.PI * 0.65
}
