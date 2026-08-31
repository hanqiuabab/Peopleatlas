import { useState, type FormEvent } from 'react'
import type { Person } from '../../domain/person'
import {
  RELATIONSHIP_LABELS,
  type Relationship,
  type RelationshipType,
} from '../../domain/relationship'
import type { RelationshipInput } from '../../domain/networkValidation'
import { getRelationshipOptions } from './relationshipOptions'

interface RelationshipFormProps {
  people: Person[]
  relationship?: Relationship
  preferredSourceId?: string
  preferredTargetId?: string
  onSubmit: (input: RelationshipInput, smartEnabled: boolean) => void
  onCancel: () => void
}

export function RelationshipForm({
  people,
  relationship,
  preferredSourceId,
  preferredTargetId,
  onSubmit,
  onCancel,
}: RelationshipFormProps) {
  const initialSourcePersonId = relationship?.sourcePersonId ?? preferredSourceId ?? people[0]?.id ?? ''
  const initialTargetPersonId = relationship?.targetPersonId ??
    (preferredTargetId !== initialSourcePersonId ? preferredTargetId : undefined) ??
    people.find((person) => person.id !== initialSourcePersonId)?.id ?? ''
  const [sourcePersonId, setSourcePersonId] = useState(initialSourcePersonId)
  const [targetPersonId, setTargetPersonId] = useState(initialTargetPersonId)
  const [type, setType] = useState<RelationshipType | ''>(
    () => relationship?.type ?? getRelationshipOptions(people, initialSourcePersonId, initialTargetPersonId)[0] ?? '',
  )
  const [error, setError] = useState('')
  const [smartEnabled, setSmartEnabled] = useState(true)
  const availableTypes = getRelationshipOptions(people, sourcePersonId, targetPersonId)
  const selectedType = type && availableTypes.includes(type) ? type : ''

  const changePeople = (sourceId: string, targetId: string) => {
    const options = getRelationshipOptions(people, sourceId, targetId)
    setSourcePersonId(sourceId)
    setTargetPersonId(targetId)
    setType((current) => current && options.includes(current) ? current : '')
    setError('')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!availableTypes.length) {
      setError('请先选择两个有效且不同的人物')
      return
    }
    if (!selectedType) {
      setError('请选择与当前人物性别匹配的关系')
      return
    }
    try {
      setError('')
      onSubmit({ sourcePersonId, targetPersonId, type: selectedType }, smartEnabled)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '保存关系失败，请重试')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="relationship-builder" aria-label="关系语句">
        <div className="form-field">
          <label htmlFor="relationship-source">人物 A</label>
          <select
            id="relationship-source"
            value={sourcePersonId}
            onChange={(event) => changePeople(event.target.value, targetPersonId)}
          >
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </div>
        <span className="relationship-builder__word">是</span>
        <div className="form-field">
          <label htmlFor="relationship-target">人物 B</label>
          <select
            id="relationship-target"
            value={targetPersonId}
            onChange={(event) => changePeople(sourcePersonId, event.target.value)}
          >
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </div>
        <span className="relationship-builder__word">的</span>
        <div className="form-field">
          <label htmlFor="relationship-type">关系</label>
          <select
            id="relationship-type"
            value={selectedType}
            disabled={!availableTypes.length}
            aria-describedby="relationship-type-hint"
            onChange={(event) => {
              setType(event.target.value as RelationshipType | '')
              setError('')
            }}
          >
            <option value="" disabled>请选择关系</option>
            {availableTypes.map((option) => (
              <option key={option} value={option}>{RELATIONSHIP_LABELS[option]}</option>
            ))}
          </select>
        </div>
      </div>
      <p id="relationship-type-hint" className="form-hint relationship-hint" role="status">
        {!availableTypes.length ? '请先选择两个有效且不同的人物。'
          : !selectedType ? '请重新选择适用于当前人物的关系。'
            : '已按人物 A、B 的性别筛选关系选项。'}
      </p>
      <p className="form-hint relationship-hint">示例：选择“林晓 是 林海 的 女儿”。同事关系按对等关系展示。</p>
      {!relationship && (
        <div className="smart-relationships__toggle">
          <label>
            <input type="checkbox" checked={smartEnabled} onChange={(event) => setSmartEnabled(event.target.checked)} />
            智能补齐家庭关系
          </label>
          <p className="form-hint">新增亲子、夫妻或兄弟姐妹关系时，自动补齐确定的家庭关系；仅长幼未知或存在冲突时弹窗确认。</p>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>取消</button>
        <button className="button button--primary" type="submit">
          {relationship ? '保存修改' : '添加关系'}
        </button>
      </footer>
    </form>
  )
}
