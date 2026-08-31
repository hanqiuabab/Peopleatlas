import { useMemo, useState } from 'react'
import { GENDERS, GENDER_LABELS, type Gender, type Person } from '../../domain/person'
import {
  RELATIONSHIP_TYPES,
  type Relationship,
  type RelationshipType,
} from '../../domain/relationship'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { Modal } from '../../shared/components/Modal'
import { PersonForm } from '../people/PersonForm'
import { RelationshipForm } from '../relationships/RelationshipForm'
import { SmartRelationshipConfirmation } from '../relationships/SmartRelationshipConfirmation'
import {
  createSmartRelationshipPlan,
  requiresSmartRelationshipConfirmation,
  resolveSmartRelationshipPlan,
  type SmartRelationshipPlan,
} from '../../domain/smartRelationships'
import { filterRelationshipsByPerson } from '../relationships/filterRelationships'
import { getRelationshipSentence } from '../relationships/relationshipPresentation'
import { NetworkGraph } from './components/NetworkGraph'
import { NebulaNetworkGraph } from './components/NebulaNetworkGraph'
import { OrbitalNetworkGraph } from './components/OrbitalNetworkGraph'
import { useRelationshipNetwork } from './useRelationshipNetwork'
import { useFlatLayoutMode } from './useFlatLayoutMode'
import {
  createRelationshipTypeVisibility,
  toggleRelationshipTypeVisibility,
  type NetworkVisibilityFilters,
} from './visibilityFilters'

type Confirmation = { title: string; message: string; action: () => void }
type RelationshipDraft = { sourcePersonId?: string; targetPersonId?: string }
type GraphViewMode = 'flat' | 'orbital' | 'nebula'

export function NetworkWorkspace() {
  const {
    network,
    createPerson,
    updatePerson,
    deletePerson,
    createRelationship,
    createRelationships,
    updateRelationship,
    deleteRelationship,
  } = useRelationshipNetwork()
  const [personEditor, setPersonEditor] = useState<Person | 'create' | null>(null)
  const [relationshipEditor, setRelationshipEditor] = useState<Relationship | 'create' | null>(null)
  const [relationshipDraft, setRelationshipDraft] = useState<RelationshipDraft>({})
  const [smartPlan, setSmartPlan] = useState<SmartRelationshipPlan | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string>()
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [viewMode, setViewMode] = useState<GraphViewMode>('flat')
  const [flatLayoutMode, setFlatLayoutMode] = useFlatLayoutMode()
  const [visibleGenders, setVisibleGenders] = useState<Set<Gender>>(() => new Set(GENDERS))
  const [showRelationships, setShowRelationships] = useState(true)
  const [visibleRelationshipTypes, setVisibleRelationshipTypes] = useState<Set<RelationshipType>>(
    () => new Set(RELATIONSHIP_TYPES),
  )

  const selectedPerson = network.people.find((person) => person.id === selectedPersonId)
  const selectedRelationship = network.relationships.find(
    (relationship) => relationship.id === selectedRelationshipId,
  )
  const visibleRelationships = useMemo(
    () => filterRelationshipsByPerson(network.relationships, selectedPersonId),
    [network.relationships, selectedPersonId],
  )
  const relatedCountByPerson = useMemo(() => {
    const counts = new Map<string, number>()
    network.relationships.forEach((relationship) => {
      counts.set(relationship.sourcePersonId, (counts.get(relationship.sourcePersonId) ?? 0) + 1)
      counts.set(relationship.targetPersonId, (counts.get(relationship.targetPersonId) ?? 0) + 1)
    })
    return counts
  }, [network.relationships])
  const visibilityFilters: NetworkVisibilityFilters = useMemo(() => ({
    visibleGenders,
    showRelationships,
    visibleRelationshipTypes,
  }), [showRelationships, visibleGenders, visibleRelationshipTypes])

  const toggleGender = (gender: Gender) => {
    if (visibleGenders.has(gender)) {
      const selectedPerson = network.people.find((person) => person.id === selectedPersonId)
      if (selectedPerson?.gender === gender) setSelectedPersonId(undefined)

      const selectedRelationship = network.relationships.find(
        (relationship) => relationship.id === selectedRelationshipId,
      )
      if (selectedRelationship) {
        const source = network.people.find(
          (person) => person.id === selectedRelationship.sourcePersonId,
        )
        const target = network.people.find(
          (person) => person.id === selectedRelationship.targetPersonId,
        )
        if (source?.gender === gender || target?.gender === gender) {
          setSelectedRelationshipId(undefined)
        }
      }
    }
    setVisibleGenders((current) => {
      const next = new Set(current)
      if (next.has(gender)) next.delete(gender)
      else next.add(gender)
      return next
    })
  }

  const toggleRelationships = () => {
    const nextShowRelationships = !showRelationships
    if (!nextShowRelationships && selectedRelationshipId) setSelectedRelationshipId(undefined)
    setShowRelationships(nextShowRelationships)
    setVisibleRelationshipTypes(createRelationshipTypeVisibility(nextShowRelationships))
  }

  const toggleRelationshipType = (type: RelationshipType) => {
    if (visibleRelationshipTypes.has(type)) {
      const selectedRelationship = network.relationships.find(
        (relationship) => relationship.id === selectedRelationshipId,
      )
      if (selectedRelationship?.type === type) setSelectedRelationshipId(undefined)
    }
    const nextVisibility = toggleRelationshipTypeVisibility(visibleRelationshipTypes, type)
    setShowRelationships(nextVisibility.showRelationships)
    setVisibleRelationshipTypes(nextVisibility.visibleRelationshipTypes)
  }

  const requestDeletePerson = (person: Person) => {
    const relationCount = relatedCountByPerson.get(person.id) ?? 0
    setConfirmation({
      title: `删除“${person.name}”？`,
      message: relationCount > 0
        ? `该人物关联了 ${relationCount} 条关系。删除人物后，这些关系也会一并删除，此操作无法撤销。`
        : '删除后将无法恢复该人物，此操作无法撤销。',
      action: () => {
        deletePerson(person.id)
        if (selectedPersonId === person.id) setSelectedPersonId(undefined)
      },
    })
  }

  const handleDeleteRelationship = (relationship: Relationship) => {
    deleteRelationship(relationship.id)
    if (selectedRelationshipId === relationship.id
      || selectedRelationshipId === relationship.inverseRelationshipId) {
      setSelectedRelationshipId(undefined)
    }
  }

  const openRelationshipCreator = (draft: RelationshipDraft = {}) => {
    setRelationshipDraft(draft)
    setRelationshipEditor('create')
  }

  const closeRelationshipEditor = () => {
    setSmartPlan(null)
    setRelationshipEditor(null)
    setRelationshipDraft({})
  }

  return (
    <div className={`app-shell app-shell--${viewMode}${viewMode === 'nebula' ? ' app-shell--orbital' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="eyebrow">
              {viewMode === 'flat'
                ? 'RELATIONSHIP ATLAS'
                : viewMode === 'orbital'
                  ? 'ORBITAL RELATIONSHIP ATLAS'
                  : 'NEBULA RELATIONSHIP ATLAS'}
            </p>
            <h1>人际关系图谱</h1>
          </div>
        </div>
        <div className="topbar__center">
          <div className="topbar__stats" aria-label="图谱统计">
            <span><strong>{network.people.length}</strong> 人物</span>
            <span><strong>{network.relationships.length}</strong> 关系</span>
          </div>
          <div className="view-switch" role="group" aria-label="图谱显示风格">
            <button
              type="button"
              aria-pressed={viewMode === 'flat'}
              onClick={() => setViewMode('flat')}
            >
              <span aria-hidden="true">⌘</span> 平面
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'orbital'}
              onClick={() => setViewMode('orbital')}
            >
              <span aria-hidden="true">◎</span> 星球
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'nebula'}
              onClick={() => setViewMode('nebula')}
            >
              <span aria-hidden="true">✦</span> 星云
            </button>
          </div>
        </div>
        <div className="topbar__actions">
          <button className="button button--secondary" type="button" onClick={() => setPersonEditor('create')}>
            <span aria-hidden="true">＋</span> 添加人物
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={network.people.length < 2}
            title={network.people.length < 2 ? '至少添加两个人物后才能建立关系' : undefined}
            onClick={() => openRelationshipCreator({ sourcePersonId: selectedPersonId })}
          >
            <span aria-hidden="true">↗</span> 添加关系
          </button>
        </div>
      </header>

      <main className="content-grid">
        <aside className="panel directory-panel" aria-label="人物目录">
          <div className="panel__header">
            <div><p className="eyebrow">人物目录</p><h2>全部人物</h2></div>
            <button className="icon-button" type="button" onClick={() => setPersonEditor('create')} aria-label="添加人物">＋</button>
          </div>
          <div className="panel__scroll">
            {network.people.length === 0 ? (
              <p className="panel-empty">还没有人物，添加后会出现在这里。</p>
            ) : network.people.map((person) => (
              <article
                key={person.id}
                className={`person-card${selectedPersonId === person.id ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelectedPersonId(person.id)
                  setSelectedRelationshipId(undefined)
                }}
              >
                <span className={`avatar avatar--${person.gender}`}>{person.name.slice(0, 1)}</span>
                <div className="person-card__content">
                  <strong>{person.name}</strong>
                  <span>{GENDER_LABELS[person.gender]} · {relatedCountByPerson.get(person.id) ?? 0} 条关系</span>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); setPersonEditor(person) }} aria-label={`编辑${person.name}`}>✎</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); requestDeletePerson(person) }} aria-label={`删除${person.name}`}>×</button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className={`canvas-panel canvas-panel--${viewMode}`} aria-label="图谱画布">
          {viewMode === 'flat' ? (
            <NetworkGraph
              layoutMode={flatLayoutMode}
              onLayoutModeChange={setFlatLayoutMode}
              people={network.people}
              relationships={network.relationships}
              selectedPersonId={selectedPersonId}
              selectedRelationshipId={selectedRelationshipId}
              visibilityFilters={visibilityFilters}
              onToggleGender={toggleGender}
              onToggleRelationships={toggleRelationships}
              onToggleRelationshipType={toggleRelationshipType}
              onSelectPerson={setSelectedPersonId}
              onSelectRelationship={setSelectedRelationshipId}
              onCreatePerson={() => setPersonEditor('create')}
              onRequestRelationship={(sourcePersonId, targetPersonId) => {
                setSelectedPersonId(sourcePersonId)
                setSelectedRelationshipId(undefined)
                openRelationshipCreator({ sourcePersonId, targetPersonId })
              }}
            />
          ) : viewMode === 'orbital' ? (
            <OrbitalNetworkGraph
              people={network.people}
              relationships={network.relationships}
              selectedPersonId={selectedPersonId}
              selectedRelationshipId={selectedRelationshipId}
              visibilityFilters={visibilityFilters}
              onToggleGender={toggleGender}
              onToggleRelationships={toggleRelationships}
              onToggleRelationshipType={toggleRelationshipType}
              onSelectPerson={setSelectedPersonId}
              onSelectRelationship={setSelectedRelationshipId}
              onCreatePerson={() => setPersonEditor('create')}
            />
          ) : (
            <NebulaNetworkGraph
              people={network.people}
              relationships={network.relationships}
              selectedPersonId={selectedPersonId}
              selectedRelationshipId={selectedRelationshipId}
              visibilityFilters={visibilityFilters}
              onToggleGender={toggleGender}
              onToggleRelationships={toggleRelationships}
              onToggleRelationshipType={toggleRelationshipType}
              onSelectPerson={setSelectedPersonId}
              onSelectRelationship={setSelectedRelationshipId}
              onCreatePerson={() => setPersonEditor('create')}
            />
          )}
          {(selectedPerson || selectedRelationship) && (
            <div className="selection-card">
              {selectedPerson ? (
                <>
                  <span className={`avatar avatar--${selectedPerson.gender}`}>{selectedPerson.name.slice(0, 1)}</span>
                  <div>
                    <span>{viewMode === 'flat'
                      ? '已选人物 · 拖动节点右侧的 ＋ 句柄可创建关系'
                      : viewMode === 'orbital'
                        ? '已选人物 · 星球视图会同步筛选相关关系'
                        : '已选人物 · 星云视图会聚焦相关关系丝线'}</span>
                    <strong>{selectedPerson.name}</strong>
                  </div>
                  {viewMode !== 'flat' && network.people.length > 1 && (
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => openRelationshipCreator({ sourcePersonId: selectedPerson.id })}
                    >连接</button>
                  )}
                  <button className="button button--ghost" type="button" onClick={() => setPersonEditor(selectedPerson)}>编辑</button>
                </>
              ) : selectedRelationship ? (
                <>
                  <span className="selection-card__link">↗</span>
                  <div><span>已选关系</span><strong>{getRelationshipSentence(selectedRelationship, network.people)}</strong></div>
                  <button className="button button--ghost" type="button" onClick={() => setRelationshipEditor(selectedRelationship)}>编辑</button>
                </>
              ) : null}
            </div>
          )}
        </section>

        <aside className="panel relations-panel" aria-label="关系列表">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{selectedPerson ? selectedPerson.name : '关系记录'}</p>
              <h2>{selectedPerson ? '相关关系' : '全部关系'}</h2>
            </div>
            <span className="count-badge">{visibleRelationships.length}</span>
          </div>
          <div className="panel__scroll">
            {visibleRelationships.length === 0 ? (
              <div className="panel-empty panel-empty--center">
                <span aria-hidden="true">⌁</span>
                <p>{selectedPerson
                  ? `暂无与“${selectedPerson.name}”相关的关系，可拖动节点句柄创建。`
                  : network.people.length < 2
                    ? '添加至少两个人物，即可建立关系。'
                    : '还没有关系，点击右上角开始连接人物。'}</p>
              </div>
            ) : visibleRelationships.map((relationship) => (
              <article
                key={relationship.id}
                className={`relationship-card${selectedRelationshipId === relationship.id ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelectedRelationshipId(relationship.id)
                  setSelectedPersonId(undefined)
                }}
              >
                <span className="relationship-card__line" aria-hidden="true">↗</span>
                <strong>{getRelationshipSentence(relationship, network.people)}</strong>
                <div className="card-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); setRelationshipEditor(relationship) }} aria-label="编辑关系">✎</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteRelationship(relationship) }} aria-label="删除关系" title="直接删除该关系及反向关系">×</button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </main>

      {personEditor && (
        <Modal
          title={personEditor === 'create' ? '添加人物' : '编辑人物'}
          description={personEditor === 'create' ? '创建一个新的图谱节点。' : '修改后会立即同步到图谱。'}
          onClose={() => setPersonEditor(null)}
        >
          <PersonForm
            person={personEditor === 'create' ? undefined : personEditor}
            onCancel={() => setPersonEditor(null)}
            onSubmit={(input) => {
              if (personEditor === 'create') createPerson(input)
              else updatePerson(personEditor.id, input)
              setPersonEditor(null)
            }}
          />
        </Modal>
      )}

      {relationshipEditor && (
        <Modal
          title={smartPlan ? '确认智能补全' : relationshipEditor === 'create' ? '添加关系' : '编辑关系'}
          description={
            smartPlan ? '已根据现有家庭关系生成建议，请核实后保存。'
              : relationshipEditor === 'create' && relationshipDraft.sourcePersonId && relationshipDraft.targetPersonId
              ? '已从图谱连接两个人物，请选择并绑定关系类型。'
              : '关系语义为：人物 A 是人物 B 的某种关系；保存时会自动维护对应的反向关系。'
          }
          onClose={closeRelationshipEditor}
        >
          <div hidden={Boolean(smartPlan)}>
            <RelationshipForm
              people={network.people}
              relationship={relationshipEditor === 'create' ? undefined : relationshipEditor}
              preferredSourceId={relationshipEditor === 'create'
                ? relationshipDraft.sourcePersonId ?? selectedPersonId
                : undefined}
              preferredTargetId={relationshipEditor === 'create'
                ? relationshipDraft.targetPersonId
                : undefined}
              onCancel={closeRelationshipEditor}
              onSubmit={(input, smartEnabled) => {
                if (relationshipEditor === 'create') {
                  if (smartEnabled) {
                    const plan = createSmartRelationshipPlan(network, input)
                    if (requiresSmartRelationshipConfirmation(plan)) {
                      setSmartPlan(plan)
                      return
                    }
                    createRelationships(resolveSmartRelationshipPlan(plan, {}))
                  } else {
                    createRelationship(input)
                  }
                } else {
                  updateRelationship(relationshipEditor.id, input)
                }
                closeRelationshipEditor()
              }}
            />
          </div>
          {smartPlan && (
            <SmartRelationshipConfirmation
              plan={smartPlan}
              people={network.people}
              onBack={() => setSmartPlan(null)}
              onCancel={closeRelationshipEditor}
              onConfirm={(inputs) => {
                createRelationships(inputs)
                closeRelationshipEditor()
              }}
            />
          )}
        </Modal>
      )}

      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.action()
            setConfirmation(null)
          }}
        />
      )}
    </div>
  )
}
