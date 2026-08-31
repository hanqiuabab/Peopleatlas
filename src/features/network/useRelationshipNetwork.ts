import { useEffect, useState } from 'react'
import type { RelationshipNetwork } from '../../domain/network'
import {
  addRelationshipPairToNetwork,
  addRelationshipBatchToNetwork,
  ensureInverseRelationships,
  getInverseRelationshipInput,
  removePersonFromNetwork,
  removeRelationshipFromNetwork,
  updateRelationshipPairInNetwork,
} from '../../domain/networkOperations'
import {
  validatePersonInput,
  validateRelationshipInput,
  type PersonInput,
  type RelationshipInput,
} from '../../domain/networkValidation'
import type { Person } from '../../domain/person'
import type { Relationship } from '../../domain/relationship'
import { loadNetwork, saveNetwork } from '../../shared/storage/networkRepository'

export class NetworkValidationError extends Error {}

export function useRelationshipNetwork() {
  const [network, setNetwork] = useState<RelationshipNetwork>(() => ensureInverseRelationships(
    loadNetwork(),
    () => crypto.randomUUID(),
    new Date().toISOString(),
  ))

  useEffect(() => {
    saveNetwork(network)
  }, [network])

  const createPerson = (input: PersonInput) => {
    const validationError = validatePersonInput(input)
    if (validationError) throw new NetworkValidationError(validationError)
    const now = new Date().toISOString()
    const person: Person = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      gender: input.gender,
      createdAt: now,
      updatedAt: now,
    }
    setNetwork((current) => ({ ...current, people: [...current.people, person] }))
    return person
  }

  const updatePerson = (id: string, input: PersonInput) => {
    const validationError = validatePersonInput(input)
    if (validationError) throw new NetworkValidationError(validationError)
    setNetwork((current) => {
      const now = new Date().toISOString()
      const updated = {
        ...current,
        people: current.people.map((person) => (
          person.id === id
            ? { ...person, name: input.name.trim(), gender: input.gender, updatedAt: now }
            : person
        )),
      }
      return ensureInverseRelationships(updated, () => crypto.randomUUID(), now)
    })
  }

  const deletePerson = (id: string) => {
    setNetwork((current) => removePersonFromNetwork(current, id))
  }

  const createRelationship = (input: RelationshipInput) => {
    const validationError = validateRelationshipInput(
      input,
      network.people,
      network.relationships,
    )
    if (validationError) throw new NetworkValidationError(validationError)
    const inverseInput = getInverseRelationshipInput(input, network.people)
    const inverseValidationError = inverseInput
      ? validateRelationshipInput(inverseInput, network.people, network.relationships)
      : '无法根据人物信息创建反向关系'
    if (inverseValidationError) {
      throw new NetworkValidationError(`无法创建反向关系：${inverseValidationError}`)
    }
    const now = new Date().toISOString()
    const result = addRelationshipPairToNetwork(network, input, () => crypto.randomUUID(), now)
    setNetwork(result.network)
    const relationship: Relationship = result.relationship
    return relationship
  }

  const updateRelationship = (id: string, input: RelationshipInput) => {
    const relationship = network.relationships.find((item) => item.id === id)
    const ignoredIds = relationship?.inverseRelationshipId ? [id, relationship.inverseRelationshipId] : id
    const validationError = validateRelationshipInput(
      input,
      network.people,
      network.relationships,
      ignoredIds,
    )
    if (validationError) throw new NetworkValidationError(validationError)
    const inverseInput = getInverseRelationshipInput(input, network.people)
    const inverseValidationError = inverseInput
      ? validateRelationshipInput(inverseInput, network.people, network.relationships, ignoredIds)
      : '无法根据人物信息创建反向关系'
    if (inverseValidationError) {
      throw new NetworkValidationError(`无法更新反向关系：${inverseValidationError}`)
    }
    setNetwork(updateRelationshipPairInNetwork(
      network,
      id,
      input,
      () => crypto.randomUUID(),
      new Date().toISOString(),
    ))
  }

  const createRelationships = (inputs: RelationshipInput[]) => {
    const next = addRelationshipBatchToNetwork(
      network, inputs, () => crypto.randomUUID(), new Date().toISOString(),
    )
    setNetwork(next)
  }

  const deleteRelationship = (id: string) => {
    setNetwork((current) => removeRelationshipFromNetwork(current, id))
  }

  const replaceNetwork = (next: RelationshipNetwork) => {
    setNetwork(ensureInverseRelationships(
      next,
      () => crypto.randomUUID(),
      new Date().toISOString(),
    ))
  }

  return {
    network,
    createPerson,
    updatePerson,
    deletePerson,
    createRelationship,
    createRelationships,
    updateRelationship,
    deleteRelationship,
    replaceNetwork,
  }
}
