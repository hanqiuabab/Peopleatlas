import { useState, type FormEvent } from 'react'
import { GENDER_LABELS, GENDERS, type Gender, type Person } from '../../domain/person'
import type { PersonInput } from '../../domain/networkValidation'

interface PersonFormProps {
  person?: Person
  onSubmit: (input: PersonInput) => void
  onCancel: () => void
}

export function PersonForm({ person, onSubmit, onCancel }: PersonFormProps) {
  const [name, setName] = useState(person?.name ?? '')
  const [gender, setGender] = useState<Gender>(person?.gender ?? 'male')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    try {
      onSubmit({ name, gender })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '保存人物失败，请重试')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="person-name">姓名</label>
        <input
          id="person-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：林晓"
          maxLength={30}
          autoFocus
        />
        <span className="form-hint">用于显示在关系图谱的节点上</span>
      </div>
      <fieldset className="form-field">
        <legend>性别</legend>
        <div className="segmented-control">
          {GENDERS.map((option) => (
            <label key={option} className={gender === option ? 'is-selected' : ''}>
              <input
                type="radio"
                name="gender"
                value={option}
                checked={gender === option}
                onChange={() => setGender(option)}
              />
              {GENDER_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>取消</button>
        <button className="button button--primary" type="submit">
          {person ? '保存修改' : '添加人物'}
        </button>
      </footer>
    </form>
  )
}

