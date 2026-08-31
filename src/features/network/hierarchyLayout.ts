import type { Relationship, RelationshipType } from '../../domain/relationship'
import type { GraphPoint } from './graphConnection'
import { orderPeopleByRelationships } from './relationshipLayout'

interface LevelConstraint {
  personId: string
  delta: number
}

export function getRelationshipLevelDelta(type: RelationshipType) {
  switch (type) {
    case 'father':
    case 'mother':
      return 1
    case 'son':
    case 'daughter':
      return -1
    case 'husband':
    case 'wife':
    case 'older_brother':
    case 'older_sister':
    case 'younger_brother':
    case 'younger_sister':
    case 'colleague':
      return 0
  }
}

/**
 * Calculates relative generations for each connected component. Components are
 * normalized independently so their lowest discovered generation starts at 0.
 * People without any valid relationship occupy a separate level -1.
 */
export function calculatePersonLevels(
  personIds: string[],
  relationships: Relationship[],
): Record<string, number> {
  const personIdSet = new Set(personIds)
  const constraints = new Map<string, LevelConstraint[]>()
  personIds.forEach((personId) => constraints.set(personId, []))

  relationships.forEach((relationship) => {
    if (
      !personIdSet.has(relationship.sourcePersonId)
      || !personIdSet.has(relationship.targetPersonId)
      || relationship.sourcePersonId === relationship.targetPersonId
    ) return

    const sourceMinusTarget = getRelationshipLevelDelta(relationship.type)
    constraints.get(relationship.sourcePersonId)?.push({
      personId: relationship.targetPersonId,
      delta: -sourceMinusTarget,
    })
    constraints.get(relationship.targetPersonId)?.push({
      personId: relationship.sourcePersonId,
      delta: sourceMinusTarget,
    })
  })

  constraints.forEach((items) => {
    items.sort((left, right) => left.personId.localeCompare(right.personId) || left.delta - right.delta)
  })

  const levels: Record<string, number> = {}
  personIds.forEach((rootPersonId) => {
    if (levels[rootPersonId] !== undefined) return
    if (!constraints.get(rootPersonId)?.length) {
      levels[rootPersonId] = -1
      return
    }

    const componentIds: string[] = [rootPersonId]
    const queue = [rootPersonId]
    levels[rootPersonId] = 0

    while (queue.length > 0) {
      const currentPersonId = queue.shift()
      if (!currentPersonId) continue
      const currentLevel = levels[currentPersonId]
      constraints.get(currentPersonId)?.forEach((constraint) => {
        if (levels[constraint.personId] !== undefined) return
        levels[constraint.personId] = currentLevel + constraint.delta
        componentIds.push(constraint.personId)
        queue.push(constraint.personId)
      })
    }

    const minimumLevel = Math.min(...componentIds.map((personId) => levels[personId]))
    componentIds.forEach((personId) => {
      levels[personId] -= minimumLevel
    })
  })

  return levels
}

export function buildHierarchyPositions(
  personIds: string[],
  levels: Record<string, number>,
  width: number,
  height: number,
  relationships: Relationship[] = [],
): Record<string, GraphPoint> {
  const peopleByLevel = new Map<number, string[]>()
  orderPeopleByRelationships(personIds, relationships).forEach((personId) => {
    const level = levels[personId] ?? 0
    peopleByLevel.set(level, [...(peopleByLevel.get(level) ?? []), personId])
  })

  const orderedLevels = [...peopleByLevel.keys()].sort((left, right) => right - left)
  const top = Math.min(210, Math.max(195, height * 0.3))
  const bottom = Math.max(top, height - 90)
  const horizontalPadding = Math.min(90, Math.max(58, width * 0.09))
  const positions: Record<string, GraphPoint> = {}

  orderedLevels.forEach((level, levelIndex) => {
    const personIdsAtLevel = peopleByLevel.get(level) ?? []
    const y = orderedLevels.length === 1
      ? height * 0.52
      : top + (levelIndex / (orderedLevels.length - 1)) * (bottom - top)
    const usableWidth = Math.max(0, width - horizontalPadding * 2)

    personIdsAtLevel.forEach((personId, personIndex) => {
      positions[personId] = {
        x: horizontalPadding + ((personIndex + 1) / (personIdsAtLevel.length + 1)) * usableWidth,
        y,
      }
    })
  })

  return positions
}
