import type { RelationshipNetwork } from '../../domain/network'
import { sanitizeNetwork } from '../storage/networkRepository'

export interface CloudNetworkSnapshot {
  network: RelationshipNetwork
  changeTag: string
  updatedAt: string
}

export function isNetworkEmpty(network: RelationshipNetwork): boolean {
  return network.people.length === 0 && network.relationships.length === 0
}

export function networkFingerprint(network: RelationshipNetwork): string {
  return JSON.stringify(network)
}

function newerByUpdatedAt<T extends { id: string; updatedAt: string }>(local: T[], cloud: T[]): T[] {
  const merged = new Map<string, T>()
  for (const item of local) merged.set(item.id, item)
  for (const item of cloud) {
    const current = merged.get(item.id)
    if (!current || item.updatedAt > current.updatedAt) merged.set(item.id, item)
  }
  return [...merged.values()]
}

export function mergeNetworks(
  local: RelationshipNetwork,
  cloud: RelationshipNetwork,
): RelationshipNetwork {
  return sanitizeNetwork({
    people: newerByUpdatedAt(local.people, cloud.people),
    relationships: newerByUpdatedAt(local.relationships, cloud.relationships),
  })
}
