import type { RelationshipNetwork } from './network'
import { getInverseRelationshipInput } from './networkOperations'
import { validateRelationshipInput, type RelationshipInput } from './networkValidation'
import type { RelationshipType } from './relationship'

export interface SuggestedRelationship {
  input: RelationshipInput
  reason: string
}

export interface SiblingQuestion {
  id: string
  sourcePersonId: string
  targetPersonId: string
  options: RelationshipType[]
  reason: string
}

export interface SmartRelationshipPlan {
  input: RelationshipInput
  automatic: SuggestedRelationship[]
  questions: SiblingQuestion[]
  warnings: string[]
}

export type SiblingChoices = Record<string, RelationshipType | 'skip' | undefined>

export function requiresSmartRelationshipConfirmation(plan: SmartRelationshipPlan): boolean {
  return plan.questions.length > 0 || plan.warnings.length > 0
}

function parentPair(input: RelationshipInput): [child: string, parent: string] | null {
  if (input.type === 'father' || input.type === 'mother') {
    return [input.targetPersonId, input.sourcePersonId]
  }
  if (input.type === 'son' || input.type === 'daughter') {
    return [input.sourcePersonId, input.targetPersonId]
  }
  return null
}

function isSibling(type: RelationshipType) {
  return ['older_brother', 'older_sister', 'younger_brother', 'younger_sister'].includes(type)
}

function isSpouse(type: RelationshipType) {
  return type === 'husband' || type === 'wife'
}

function connects(input: RelationshipInput, a: string, b: string) {
  return (input.sourcePersonId === a && input.targetPersonId === b)
    || (input.sourcePersonId === b && input.targetPersonId === a)
}

function parentsOf(relationships: RelationshipInput[], child: string) {
  return new Set(relationships.flatMap((relation) => {
    const pair = parentPair(relation)
    return pair?.[0] === child ? [pair[1]] : []
  }))
}

function ancestorsOf(relationships: RelationshipInput[], personId: string) {
  const ancestors = new Set<string>()
  const queue = [...parentsOf(relationships, personId)]
  while (queue.length) {
    const id = queue.pop()!
    if (ancestors.has(id)) continue
    ancestors.add(id)
    queue.push(...parentsOf(relationships, id))
  }
  return ancestors
}

/** A read-only, bounded preview: never recursively invent extended family or ages. */
export function createSmartRelationshipPlan(
  network: RelationshipNetwork,
  input: RelationshipInput,
): SmartRelationshipPlan {
  const error = validateRelationshipInput(input, network.people, network.relationships)
  if (error) throw new Error(error)
  const inverse = getInverseRelationshipInput(input, network.people)
  const inverseError = inverse && validateRelationshipInput(inverse, network.people, network.relationships)
  if (inverseError) throw new Error(inverseError)
  const plan: SmartRelationshipPlan = { input, automatic: [], questions: [], warnings: [] }
  const initialPair = parentPair(input)
  const spouseAddition = isSpouse(input.type)
  if (!initialPair && !isSibling(input.type) && !spouseAddition) return plan

  const people = new Map(network.people.map((person) => [person.id, person]))
  const name = (id: string) => people.get(id)?.name ?? '未知人物'
  const relations: RelationshipInput[] = [...network.relationships, input]
  const warn = (message: string) => {
    if (!plan.warnings.includes(message)) plan.warnings.push(message)
  }
  const addParent = (child: string, parent: string, reason: string) => {
    if (parentsOf(relations, child).has(parent)) return
    const conflict = child === parent
      || ancestorsOf(relations, parent).has(child)
      || relations.some((relation) => connects(relation, child, parent)
        && (isSibling(relation.type) || isSpouse(relation.type)))
    const otherParent = [...parentsOf(relations, child)].find(
      (id) => people.get(id)?.gender === people.get(parent)?.gender,
    )
    if (conflict || otherParent) {
      warn(`未补齐${name(child)}与${name(parent)}的亲子关系：${otherParent ? '已有同类父母，请核实家庭情况' : '与现有亲属身份冲突'}。`)
      return
    }
    const suggestion: RelationshipInput = {
      sourcePersonId: child,
      targetPersonId: parent,
      type: people.get(child)?.gender === 'male' ? 'son' : 'daughter',
    }
    relations.push(suggestion)
    plan.automatic.push({ input: suggestion, reason })
  }

  const couple = [input.sourcePersonId, input.targetPersonId]
  // Only revisit the couple's direct children; other parents must not spread across children.
  const children = spouseAddition
    ? [...new Set(relations.flatMap((relation) => {
      const pair = parentPair(relation)
      return pair && couple.includes(pair[1]) ? [pair[0]] : []
    }))]
    : initialPair ? [initialPair[0]] : couple
  if (children.length === 0) return plan
  const knownParents = new Set(spouseAddition
    ? couple : children.flatMap((child) => [...parentsOf(relations, child)]))
  // Different known parents of the same gender may indicate half-siblings: do not choose one.
  const parentCandidates = new Set(knownParents)
  for (const parent of knownParents) {
    const spouses = new Set(relations.filter((relation) => isSpouse(relation.type)
      && (relation.sourcePersonId === parent || relation.targetPersonId === parent))
      .map((relation) => relation.sourcePersonId === parent ? relation.targetPersonId : relation.sourcePersonId))
    if (spouses.size > 1) {
      warn(`${name(parent)}有多位配偶，未自动选择另一位家长，请手动确认。`)
      // A new marriage only implies shared parents when both partners are unambiguous.
      if (spouseAddition) return plan
    } else if (spouses.size === 1) {
      parentCandidates.add([...spouses][0])
    }
  }

  for (const child of children) {
    for (const parent of parentCandidates) {
      if (parentsOf(relations, child).has(parent)) continue
      const sameGenderCandidates = [...parentCandidates].filter(
        (id) => people.get(id)?.gender === people.get(parent)?.gender,
      )
      if (sameGenderCandidates.length > 1) {
        warn(`${name(child)}的父母候选存在冲突，未自动添加${name(parent)}，请手动确认。`)
        continue
      }
      addParent(child, parent, spouseAddition
        ? '根据新增夫妻关系及双方互为唯一配偶补齐另一位家长'
        : knownParents.has(parent)
        ? '根据已知兄弟姐妹共享父母'
        : '根据已知家长的唯一配偶补齐另一位家长')
    }
  }

  const visitedSiblingPairs = new Set<string>()
  for (const child of children) {
    const parents = parentsOf(relations, child)
    for (const relation of relations) {
      const pair = parentPair(relation)
      if (!pair || !parents.has(pair[1]) || pair[0] === child) continue
      const sibling = pair[0]
      const key = JSON.stringify([child, sibling].sort())
      if (visitedSiblingPairs.has(key)) continue
      visitedSiblingPairs.add(key)
      if (relations.some((item) => connects(item, child, sibling) && isSibling(item.type))) continue
      if (ancestorsOf(relations, child).has(sibling) || ancestorsOf(relations, sibling).has(child)
        || relations.some((item) => connects(item, child, sibling) && isSpouse(item.type))) {
        warn(`未补齐${name(child)}与${name(sibling)}的兄弟姐妹关系：与现有亲属身份冲突。`)
        continue
      }
      plan.questions.push({
        id: key,
        sourcePersonId: child,
        targetPersonId: sibling,
        options: people.get(child)?.gender === 'male'
          ? ['older_brother', 'younger_brother'] : ['older_sister', 'younger_sister'],
        reason: `共同家长：${name(pair[1])}；尚不知道谁年长`,
      })
    }
  }
  return plan
}

export function resolveSmartRelationshipPlan(
  plan: SmartRelationshipPlan,
  choices: SiblingChoices,
): RelationshipInput[] {
  const inputs = [plan.input, ...plan.automatic.map((item) => item.input)]
  for (const question of plan.questions) {
    const choice = choices[question.id]
    if (choice === 'skip') continue
    if (!choice || !question.options.includes(choice)) {
      throw new Error('请逐项确认长幼关系，或选择“暂不添加”')
    }
    inputs.push({ sourcePersonId: question.sourcePersonId, targetPersonId: question.targetPersonId, type: choice })
  }
  return inputs
}
