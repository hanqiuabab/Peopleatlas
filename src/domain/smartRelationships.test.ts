import { describe, expect, it } from 'vitest'
import type { RelationshipNetwork } from './network'
import { addRelationshipBatchToNetwork, addRelationshipPairToNetwork } from './networkOperations'
import type { RelationshipInput } from './networkValidation'
import type { RelationshipType } from './relationship'
import { createSmartRelationshipPlan, requiresSmartRelationshipConfirmation, resolveSmartRelationshipPlan } from './smartRelationships'

const people: RelationshipNetwork['people'] = [
  { id: 'a', name: 'A', gender: 'male', createdAt: '', updatedAt: '' },
  { id: 'b', name: 'B', gender: 'female', createdAt: '', updatedAt: '' },
  { id: 'c', name: 'C', gender: 'male', createdAt: '', updatedAt: '' },
  { id: 'd', name: 'D', gender: 'female', createdAt: '', updatedAt: '' },
  { id: 'e', name: 'E', gender: 'female', createdAt: '', updatedAt: '' },
  { id: 'f', name: 'F', gender: 'male', createdAt: '', updatedAt: '' },
]
const relation = (sourcePersonId: string, targetPersonId: string, type: RelationshipType): RelationshipInput =>
  ({ sourcePersonId, targetPersonId, type })
const makeNetwork = (...inputs: RelationshipInput[]) => {
  let id = 0
  return inputs.reduce((network, input) => addRelationshipPairToNetwork(
    network, input, () => `r${id++}`, 'before',
  ).network, { people, relationships: [] } as RelationshipNetwork)
}
const family = () => makeNetwork(relation('a', 'b', 'husband'), relation('c', 'a', 'son'), relation('c', 'b', 'son'))
const automaticInputs = (plan: ReturnType<typeof createSmartRelationshipPlan>) => plan.automatic.map((item) => item.input)

describe('smart family relationship preview', () => {
  it('adds the other parent and asks the new daughter’s age relative to the existing son', () => {
    const network = family()
    const before = structuredClone(network)
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(automaticInputs(plan)).toEqual([relation('d', 'b', 'daughter')])
    expect(plan.questions).toEqual([expect.objectContaining({
      sourcePersonId: 'd', targetPersonId: 'c', options: ['older_sister', 'younger_sister'],
    })])
    expect(plan.warnings).toEqual([])
    expect(network).toEqual(before) // preview/cancellation is entirely read-only
  })

  it.each(['older_sister', 'younger_sister'] as const)('inherits both parents for a new %s', (type) => {
    const plan = createSmartRelationshipPlan(family(), relation('d', 'c', type))
    expect(automaticInputs(plan)).toEqual([relation('d', 'a', 'daughter'), relation('d', 'b', 'daughter')])
    expect(plan.questions).toEqual([]) // the supplied sibling age is already known
  })

  it('works with the inverse parent direction', () => {
    const plan = createSmartRelationshipPlan(family(), relation('a', 'd', 'father'))
    expect(automaticInputs(plan)).toEqual([relation('d', 'b', 'daughter')])
    expect(plan.questions).toHaveLength(1)
  })

  it('inherits parents when the existing sibling is the source of the new relationship', () => {
    const plan = createSmartRelationshipPlan(family(), relation('c', 'd', 'younger_brother'))
    expect(automaticInputs(plan)).toEqual([relation('d', 'a', 'daughter'), relation('d', 'b', 'daughter')])
    expect(plan.questions).toHaveLength(0)
  })

  it('infers a spouse as the missing parent from a single known parent', () => {
    const network = makeNetwork(relation('a', 'b', 'husband'), relation('c', 'a', 'son'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'c', 'older_sister'))
    expect(automaticInputs(plan)).toEqual(expect.arrayContaining([
      relation('d', 'a', 'daughter'), relation('d', 'b', 'daughter'), relation('c', 'b', 'son'),
    ]))
    expect(plan.questions).toHaveLength(0)
  })

  it('uses male sibling choices and never guesses relative ages', () => {
    const plan = createSmartRelationshipPlan(family(), relation('f', 'a', 'son'))
    expect(plan.questions[0].options).toEqual(['older_brother', 'younger_brother'])
    expect(() => resolveSmartRelationshipPlan(plan, {})).toThrow('请逐项确认')
    expect(() => resolveSmartRelationshipPlan(plan, { [plan.questions[0].id]: 'older_sister' })).toThrow('请逐项确认')
  })

  it('deduplicates both parents and already known sibling relationships', () => {
    const network = makeNetwork(
      relation('a', 'b', 'husband'), relation('c', 'a', 'son'), relation('c', 'b', 'son'),
      relation('d', 'b', 'daughter'), relation('c', 'd', 'younger_brother'),
    )
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.automatic).toHaveLength(0)
    expect(plan.questions).toHaveLength(0)
  })

  it('recognizes existing one-way parent data without requiring inverse IDs', () => {
    const network = family()
    network.relationships = network.relationships.filter((item) => ['husband', 'father', 'mother'].includes(item.type))
    const plan = createSmartRelationshipPlan(network, relation('d', 'c', 'older_sister'))
    expect(automaticInputs(plan)).toEqual([relation('d', 'a', 'daughter'), relation('d', 'b', 'daughter')])
  })

  it.each(['husband', 'colleague'] as const)('does not expand unrelated families on %s creation', (type) => {
    const plan = createSmartRelationshipPlan(family(), relation('f', 'd', type))
    expect(plan.automatic).toHaveLength(0)
    expect(plan.questions).toHaveLength(0)
  })

  it('supports skipping one sibling without losing other confirmed choices', () => {
    const network = makeNetwork(relation('c', 'a', 'son'), relation('e', 'a', 'daughter'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.questions).toHaveLength(2)
    expect(() => resolveSmartRelationshipPlan(plan, { [plan.questions[0].id]: 'skip' })).toThrow('请逐项确认')
    const result = resolveSmartRelationshipPlan(plan, {
      [plan.questions[0].id]: 'skip', [plan.questions[1].id]: 'younger_sister',
    })
    expect(result).toEqual([relation('d', 'a', 'daughter'), relation('d', 'e', 'younger_sister')])
  })

  it('warns instead of selecting one of multiple spouses', () => {
    const network = makeNetwork(relation('a', 'b', 'husband'), relation('a', 'e', 'husband'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.automatic).toHaveLength(0)
    expect(plan.warnings.join('')).toContain('多位配偶')
  })

  it('does not overwrite different known mothers for half-siblings', () => {
    const network = makeNetwork(relation('c', 'b', 'son'), relation('d', 'e', 'daughter'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'c', 'older_sister'))
    expect(plan.automatic).toHaveLength(0)
    expect(plan.warnings.join('')).toContain('父母候选存在冲突')
  })

  it('skips inferred parent identities that conflict with an existing sibling identity', () => {
    const network = makeNetwork(relation('a', 'b', 'husband'), relation('d', 'b', 'younger_sister'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.automatic).toHaveLength(0)
    expect(plan.warnings.join('')).toContain('亲属身份冲突')
  })

  it('does not introduce an ancestor cycle', () => {
    const network = makeNetwork(relation('a', 'b', 'husband'), relation('b', 'f', 'daughter'), relation('f', 'd', 'son'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.automatic).toHaveLength(0)
    expect(plan.warnings.join('')).toContain('亲属身份冲突')
  })

  it('does not turn spouses with a common parent into siblings', () => {
    const network = makeNetwork(relation('c', 'a', 'son'), relation('c', 'd', 'husband'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.questions).toHaveLength(0)
    expect(plan.warnings.join('')).toContain('亲属身份冲突')
  })

  it('validates explicit self-links and existing relations before previewing', () => {
    expect(() => createSmartRelationshipPlan(family(), relation('d', 'd', 'daughter'))).toThrow('自身关系')
    expect(() => createSmartRelationshipPlan(family(), relation('c', 'a', 'son'))).toThrow('已经存在')
  })

  it('rejects a gender-incompatible relation before smart inference', () => {
    expect(() => createSmartRelationshipPlan(family(), relation('d', 'f', 'husband'))).toThrow('性别不匹配')
  })
})

describe('adding spouses after children', () => {
  it.each(['husband', 'wife'] as const)('completes either spouse’s son or daughter when adding %s', (type) => {
    const spouse = type === 'husband' ? relation('a', 'b', type) : relation('b', 'a', type)
    for (const parent of ['a', 'b']) {
      for (const [child, childType] of [['c', 'son'], ['d', 'daughter']] as const) {
        const other = parent === 'a' ? 'b' : 'a'
        const existing = relation(parent, child, parent === 'a' ? 'father' : 'mother')
        const network = makeNetwork(existing)
        const before = structuredClone(network)
        const plan = createSmartRelationshipPlan(network, spouse)
        expect(automaticInputs(plan)).toEqual([relation(child, other, childType)])
        expect(requiresSmartRelationshipConfirmation(plan)).toBe(false)
        let id = 0
        const saved = addRelationshipBatchToNetwork(network, resolveSmartRelationshipPlan(plan, {}), () => `new${id++}`, 'now')
        expect(saved.relationships).toHaveLength(6)
        expect(saved.relationships).toEqual(expect.arrayContaining([
          expect.objectContaining(relation(other, child, other === 'a' ? 'father' : 'mother')),
          expect.objectContaining(relation(child, other, childType)),
        ]))
        // Adding the parent first or the spouse first must produce the same semantic edges.
        const reverseOrder = makeNetwork(spouse)
        const reversePlan = createSmartRelationshipPlan(reverseOrder, existing)
        const reverseSaved = addRelationshipBatchToNetwork(reverseOrder, resolveSmartRelationshipPlan(reversePlan, {}), () => `other${id++}`, 'now')
        const keys = (value: RelationshipNetwork) => value.relationships.map((r) => `${r.sourcePersonId}:${r.targetPersonId}:${r.type}`).sort()
        expect(keys(saved)).toEqual(keys(reverseSaved))
        expect(network).toEqual(before)
      }
    }
  })

  it('completes both sides and asks only once for their children’s unknown age order', () => {
    const network = makeNetwork(relation('c', 'a', 'son'), relation('d', 'b', 'daughter'))
    const plan = createSmartRelationshipPlan(network, relation('b', 'a', 'wife'))
    expect(automaticInputs(plan)).toEqual(expect.arrayContaining([relation('c', 'b', 'son'), relation('d', 'a', 'daughter')]))
    expect(plan.automatic).toHaveLength(2)
    expect(plan.questions).toHaveLength(1)
    expect(plan.warnings).toEqual([])
    expect(() => resolveSmartRelationshipPlan(plan, {})).toThrow('请逐项确认')
    expect(resolveSmartRelationshipPlan(plan, { [plan.questions[0].id]: 'skip' })).toHaveLength(3)
    const known = makeNetwork(relation('c', 'a', 'son'), relation('d', 'b', 'daughter'), relation('c', 'd', 'older_brother'))
    expect(createSmartRelationshipPlan(known, relation('a', 'b', 'husband')).questions).toHaveLength(0)
  })

  it.each([
    [relation('c', 'a', 'son'), relation('c', 'e', 'son')],
    [relation('d', 'b', 'daughter'), relation('d', 'f', 'daughter')],
  ])('preserves an existing other parent without spreading that parent to other children', (...existing) => {
    const network = makeNetwork(...existing)
    const plan = createSmartRelationshipPlan(network, relation('b', 'a', 'wife'))
    expect(plan.automatic).toEqual([])
    expect(plan.warnings.join('')).toContain('已有同类父母')
    const withOtherChild = makeNetwork(...existing, relation('a', 'e', 'father'))
    const expanded = createSmartRelationshipPlan(withOtherChild, relation('b', 'a', 'wife'))
    expect(automaticInputs(expanded)).toEqual([relation('e', 'b', 'daughter')])
  })

  it.each([relation('a', 'e', 'husband'), relation('f', 'b', 'husband')])('skips ambiguous spouses on either side: %o', (existingSpouse) => {
    const network = makeNetwork(relation('c', 'a', 'son'), relation('d', 'b', 'daughter'), existingSpouse)
    const plan = createSmartRelationshipPlan(network, relation('b', 'a', 'wife'))
    expect(plan.automatic).toEqual([])
    expect(plan.questions).toEqual([])
    expect(plan.warnings.join('')).toContain('多位配偶')
  })

  it('deduplicates known parents and does not expand grandchildren', () => {
    const network = makeNetwork(relation('c', 'a', 'son'), relation('c', 'b', 'son'), relation('d', 'c', 'daughter'))
    const plan = createSmartRelationshipPlan(network, relation('a', 'b', 'husband'))
    expect(plan.automatic).toEqual([])
    expect(requiresSmartRelationshipConfirmation(plan)).toBe(false)
  })

  it.each([
    [relation('c', 'b', 'older_brother')],
    [relation('c', 'b', 'husband')],
    [relation('b', 'f', 'daughter'), relation('f', 'c', 'son')],
  ])('does not create conflicting parent roles or ancestor loops: %o', (...conflicts) => {
    const network = makeNetwork(relation('c', 'a', 'son'), ...conflicts)
    const plan = createSmartRelationshipPlan(network, relation('b', 'a', 'wife'))
    expect(plan.automatic).toEqual([])
    expect(plan.warnings.length).toBeGreaterThan(0)
  })

  it('recognizes legacy one-way parent records when adding a spouse', () => {
    const network = makeNetwork(relation('a', 'c', 'father'))
    network.relationships = network.relationships.filter((item) => item.type === 'father')
    expect(automaticInputs(createSmartRelationshipPlan(network, relation('b', 'a', 'wife')))).toEqual([relation('c', 'b', 'son')])
  })
})

describe('smart relationship confirmation policy', () => {
  it('directly resolves all inferred parents and their inverses when the sibling age is known', () => {
    const network = family()
    const plan = createSmartRelationshipPlan(network, relation('d', 'c', 'older_sister'))
    expect(requiresSmartRelationshipConfirmation(plan)).toBe(false)
    const inputs = resolveSmartRelationshipPlan(plan, {})
    expect(inputs).toEqual([
      relation('d', 'c', 'older_sister'), relation('d', 'a', 'daughter'), relation('d', 'b', 'daughter'),
    ])
    let id = 0
    const result = addRelationshipBatchToNetwork(network, inputs, () => `auto${id++}`, 'now')
    expect(result.relationships).toHaveLength(network.relationships.length + 6)
    expect(result.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining(relation('c', 'd', 'younger_brother')),
      expect.objectContaining(relation('a', 'd', 'father')),
      expect.objectContaining(relation('b', 'd', 'mother')),
    ]))
  })

  it('does not prompt when there is nothing to infer', () => {
    const plan = createSmartRelationshipPlan(family(), relation('d', 'c', 'colleague'))
    expect(requiresSmartRelationshipConfirmation(plan)).toBe(false)
    expect(resolveSmartRelationshipPlan(plan, {})).toEqual([plan.input])
  })

  it('still prompts for uncertain ages even when some relations are determined', () => {
    const plan = createSmartRelationshipPlan(family(), relation('d', 'a', 'daughter'))
    expect(plan.automatic).toHaveLength(1)
    expect(requiresSmartRelationshipConfirmation(plan)).toBe(true)
  })

  it('still prompts for conflicts even without uncertain ages', () => {
    const network = makeNetwork(relation('a', 'b', 'husband'), relation('a', 'e', 'husband'))
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    expect(plan.questions).toHaveLength(0)
    expect(requiresSmartRelationshipConfirmation(plan)).toBe(true)
  })
})

describe('atomic smart relationship commit', () => {
  it('does not save any changes when a later relationship is gender-incompatible', () => {
    const network = family()
    const before = structuredClone(network)
    expect(() => addRelationshipBatchToNetwork(network, [
      relation('d', 'a', 'daughter'), relation('d', 'f', 'husband'),
    ], () => crypto.randomUUID(), 'now')).toThrow('性别不匹配')
    expect(network).toEqual(before)
  })

  it('creates all confirmed pairs with linked, gender-aware inverses', () => {
    const network = family()
    const plan = createSmartRelationshipPlan(network, relation('d', 'a', 'daughter'))
    let id = 0
    const inputs = resolveSmartRelationshipPlan(plan, { [plan.questions[0].id]: 'older_sister' })
    const result = addRelationshipBatchToNetwork(network, inputs, () => `new${id++}`, 'now')
    expect(result.relationships).toHaveLength(network.relationships.length + 6)
    expect(result.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining(relation('a', 'd', 'father')),
      expect.objectContaining(relation('b', 'd', 'mother')),
      expect.objectContaining(relation('c', 'd', 'younger_brother')),
    ]))
    for (const item of result.relationships) {
      expect(result.relationships.find((inverse) => inverse.id === item.inverseRelationshipId)?.inverseRelationshipId).toBe(item.id)
    }
    expect(network.relationships).toHaveLength(6)
  })

  it('leaves the original snapshot untouched if a later input fails validation', () => {
    const network = family()
    const before = structuredClone(network)
    let id = 0
    expect(() => addRelationshipBatchToNetwork(network, [
      relation('d', 'a', 'daughter'), relation('d', 'missing', 'older_sister'),
    ], () => `new${id++}`, 'now')).toThrow('终点人物')
    expect(network).toEqual(before)
  })

  it('rejects duplicates within the batch, including inverse pairs', () => {
    expect(() => addRelationshipBatchToNetwork(family(), [
      relation('d', 'a', 'daughter'), relation('a', 'd', 'father'),
    ], () => crypto.randomUUID(), 'now')).toThrow('已经存在')
  })
})
