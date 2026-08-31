import { useState, type FormEvent } from 'react'
import type { Person } from '../../domain/person'
import type { RelationshipInput } from '../../domain/networkValidation'
import { RELATIONSHIP_LABELS, type RelationshipType } from '../../domain/relationship'
import {
  resolveSmartRelationshipPlan,
  type SiblingChoices,
  type SmartRelationshipPlan,
} from '../../domain/smartRelationships'

interface SmartRelationshipConfirmationProps {
  plan: SmartRelationshipPlan
  people: Person[]
  onConfirm: (inputs: RelationshipInput[]) => void
  onBack: () => void
  onCancel: () => void
}

export function SmartRelationshipConfirmation({
  plan, people, onConfirm, onBack, onCancel,
}: SmartRelationshipConfirmationProps) {
  const [choices, setChoices] = useState<SiblingChoices>({})
  const [error, setError] = useState('')
  const name = (id: string) => people.find((person) => person.id === id)?.name ?? '未知人物'
  const sentence = (input: RelationshipInput) =>
    `${name(input.sourcePersonId)} 是 ${name(input.targetPersonId)} 的${RELATIONSHIP_LABELS[input.type]}`
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    try {
      onConfirm(resolveSmartRelationshipPlan(plan, choices))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败，请重试')
    }
  }

  return (
    <form className="smart-relationships" onSubmit={handleSubmit} noValidate>
      <div className="smart-relationships__content">
        <section aria-label="本次添加">
          <h3>本次添加</h3>
          <p className="smart-relationships__original">{sentence(plan.input)}</p>
        </section>
        {plan.automatic.length > 0 && (
          <section aria-label="自动补齐">
            <h3>自动补齐 <span>{plan.automatic.length} 条</span></h3>
            <ul className="smart-relationships__list">
              {plan.automatic.map(({ input, reason }) => (
                <li key={`${input.sourcePersonId}:${input.targetPersonId}:${input.type}`}>
                  <strong>{sentence(input)}</strong>
                  <small>{reason}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
        {plan.questions.length > 0 && (
          <section aria-label="确认长幼关系">
            <h3>需要你确认 <span>{plan.questions.length} 对</span></h3>
            <p className="form-hint">根据姓名无法判断年龄，请逐项选择，也可以暂不添加。</p>
            {plan.questions.map((question, index) => (
              <div className="form-field smart-relationships__question" key={question.id}>
                <label htmlFor={`sibling-choice-${index}`}>
                  {name(question.sourcePersonId)} 是 {name(question.targetPersonId)} 的？
                </label>
                <select
                  id={`sibling-choice-${index}`}
                  autoFocus={index === 0}
                  aria-describedby={`sibling-reason-${index}`}
                  value={choices[question.id] ?? ''}
                  onChange={(event) => {
                    setChoices((current) => ({
                      ...current, [question.id]: event.target.value as RelationshipType | 'skip' | undefined,
                    }))
                    setError('')
                  }}
                >
                  <option value="">请选择长幼关系</option>
                  {question.options.map((type) => <option key={type} value={type}>{RELATIONSHIP_LABELS[type]}</option>)}
                  <option value="skip">暂不添加</option>
                </select>
                <small id={`sibling-reason-${index}`} className="form-hint">{question.reason}</small>
              </div>
            ))}
          </section>
        )}
        {plan.warnings.length > 0 && (
          <section className="smart-relationships__warnings" aria-label="未自动补齐的关系">
            <h3>以下情况需要手动核实</h3>
            <ul>{plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>
        )}
        <p className="form-hint">每条关系都会同时创建反向关系。尚未保存任何内容；如涉及重组家庭，可返回关闭智能补全后单独添加。</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>取消</button>
        <button className="button button--ghost" type="button" onClick={onBack}>返回修改</button>
        <button className="button button--primary" type="submit" autoFocus={plan.questions.length === 0}>确认并添加</button>
      </footer>
    </form>
  )
}
