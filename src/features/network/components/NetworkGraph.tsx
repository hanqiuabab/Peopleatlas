import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import type { Person } from '../../../domain/person'
import type { Relationship } from '../../../domain/relationship'
import type { FlatLayoutMode } from '../flatLayoutPreferences'
import { findConnectionTarget, type GraphPoint } from '../graphConnection'
import { buildHierarchyPositions, calculatePersonLevels } from '../hierarchyLayout'
import { buildRingPositions, getRingGeometry } from '../ringLayout'
import { groupRelationshipsForDisplay } from '../relationshipDisplay'
import { orderPeopleByRelationships, reconcileFreePositions } from '../relationshipLayout'
import { useGraphFullscreen } from '../useGraphFullscreen'
import { useRingRotation } from '../useRingRotation'
import { filterNetworkByVisibility } from '../visibilityFilters'
import {
  GraphVisibilityFilters,
  type GraphVisibilityFilterProps,
} from './GraphVisibilityFilters'

type Point = GraphPoint

interface NetworkGraphProps extends GraphVisibilityFilterProps {
  layoutMode: FlatLayoutMode
  onLayoutModeChange: (mode: FlatLayoutMode) => void
  people: Person[]
  relationships: Relationship[]
  selectedPersonId?: string
  selectedRelationshipId?: string
  onSelectPerson: (id?: string) => void
  onSelectRelationship: (id?: string) => void
  onCreatePerson: () => void
  onRequestRelationship: (sourcePersonId: string, targetPersonId: string) => void
}

type PointerInteraction =
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'node'; id: string; lastX: number; lastY: number; startX: number; startY: number; moved: boolean; deselectOnRelease: boolean }
  | { kind: 'connect'; sourcePersonId: string; targetPersonId?: string }

interface ConnectionPreview {
  sourcePersonId: string
  pointer: Point
  targetPersonId?: string
}

const MIN_ZOOM = 0.55
const MAX_ZOOM = 1.8

export function NetworkGraph({
  layoutMode,
  onLayoutModeChange,
  people,
  relationships,
  selectedPersonId,
  selectedRelationshipId,
  onSelectPerson,
  onSelectRelationship,
  onCreatePerson,
  onRequestRelationship,
  visibilityFilters,
  onToggleGender,
  onToggleRelationships,
  onToggleRelationshipType,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, fullscreenError, toggleFullscreen } = useGraphFullscreen(containerRef)
  const interactionRef = useRef<PointerInteraction | null>(null)
  const [size, setSize] = useState({ width: 900, height: 620 })
  const previousSizeRef = useRef(size)
  const [freePositions, setPositions] = useState<Record<string, Point>>({})
  const manuallyPlacedRef = useRef(new Set<string>())
  const preserveFreePositionsRef = useRef(false)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const isHierarchyLayout = layoutMode === 'hierarchy'
  const isRingLayout = layoutMode === 'ring'
  const [isInteracting, setIsInteracting] = useState(false)
  const [connectionPreview, setConnectionPreview] = useState<ConnectionPreview>()
  const { visiblePeople, visibleRelationships } = useMemo(
    () => filterNetworkByVisibility(people, relationships, visibilityFilters),
    [people, relationships, visibilityFilters],
  )
  const ringSelectedPersonId = visiblePeople.some((person) => person.id === selectedPersonId)
    ? selectedPersonId : undefined
  const ringSelectedRelationshipId = visibleRelationships.some((item) => item.id === selectedRelationshipId)
    ? selectedRelationshipId : undefined
  const hasRingSelection = Boolean(ringSelectedPersonId || ringSelectedRelationshipId)
  const { rotation, isPaused, togglePause, resetRotation } = useRingRotation({
    active: isRingLayout,
    personCount: visiblePeople.length,
    isInteracting,
    selectedPersonId: ringSelectedPersonId,
    selectedRelationshipId: ringSelectedRelationshipId,
  })
  const displayRelationships = useMemo(
    () => groupRelationshipsForDisplay(visibleRelationships),
    [visibleRelationships],
  )
  const orderedPersonIds = useMemo(
    () => orderPeopleByRelationships(people.map((person) => person.id), relationships),
    [people, relationships],
  )
  const visibleOrderedPersonIds = useMemo(() => {
    const visibleIds = new Set(visiblePeople.map((person) => person.id))
    return orderedPersonIds.filter((id) => visibleIds.has(id))
  }, [orderedPersonIds, visiblePeople])
  const defaultFreePositions = useMemo(
    () => buildRingPositions(orderedPersonIds, size.width, size.height),
    [orderedPersonIds, size.width, size.height],
  )
  const hierarchyPeopleKey = people.map((person) => person.id).sort().join('|')
  const hierarchyRelationshipsKey = relationships
    .map((relationship) => [
      relationship.id,
      relationship.sourcePersonId,
      relationship.targetPersonId,
      relationship.type,
    ].join(':'))
    .sort()
    .join('|')
  const hierarchyLevels = useMemo(
    () => calculatePersonLevels(people.map((person) => person.id), relationships),
    [hierarchyPeopleKey, hierarchyRelationshipsKey],
  )
  const hierarchyPositions = useMemo(
    () => buildHierarchyPositions(
      people.map((person) => person.id),
      hierarchyLevels,
      size.width,
      size.height,
      relationships,
    ),
    [hierarchyLevels, hierarchyPeopleKey, hierarchyRelationshipsKey, size.height, size.width],
  )
  const ringPositions = useMemo(
    () => isRingLayout
      ? buildRingPositions(visibleOrderedPersonIds, size.width, size.height, rotation)
      : {},
    [isRingLayout, rotation, size.height, size.width, visibleOrderedPersonIds],
  )
  const ringGeometry = getRingGeometry(size.width, size.height)
  // Automatic layouts are derived directly from current data, including while paused.
  const positions = isRingLayout ? ringPositions : isHierarchyLayout ? hierarchyPositions : freePositions
  const visiblePositions = useMemo(
    () => Object.fromEntries(visiblePeople.flatMap((person) => (
      positions[person.id] ? [[person.id, positions[person.id]]] : []
    ))),
    [positions, visiblePeople],
  )
  const hierarchyGuides = useMemo(() => {
    const firstPersonIdByLevel = new Map<number, string>()
    people.forEach((person) => {
      const level = hierarchyLevels[person.id] ?? 0
      if (!firstPersonIdByLevel.has(level)) firstPersonIdByLevel.set(level, person.id)
    })
    return [...firstPersonIdByLevel.entries()]
      .sort(([left], [right]) => right - left)
      .map(([level, personId]) => ({ level, y: hierarchyPositions[personId]?.y ?? 0 }))
  }, [hierarchyLevels, hierarchyPositions, people])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previous = previousSizeRef.current
    if (previous.width === size.width && previous.height === size.height) return
    previousSizeRef.current = size
    if (layoutMode !== 'free') return
    const scaleX = size.width / Math.max(previous.width, 1)
    const scaleY = size.height / Math.max(previous.height, 1)
    setPositions((current) => Object.fromEntries(
      Object.entries(current).map(([id, point]) => [
        id,
        {
          x: Math.min(Math.max(point.x * scaleX, 52), Math.max(size.width - 52, 52)),
          y: Math.min(Math.max(point.y * scaleY, 52), Math.max(size.height - 52, 52)),
        },
      ]),
    ))
  }, [layoutMode, size])

  useEffect(() => {
    if (layoutMode !== 'free') return
    const preserveCurrent = preserveFreePositionsRef.current
    preserveFreePositionsRef.current = false
    setPositions((current) => reconcileFreePositions(
      defaultFreePositions, current, manuallyPlacedRef.current, preserveCurrent,
    ))
  }, [layoutMode, defaultFreePositions])

  useLayoutEffect(() => {
    if (!isHierarchyLayout) return
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [hierarchyPositions, hierarchyRelationshipsKey, isHierarchyLayout])

  const resetView = () => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
    if (isRingLayout) {
      resetRotation()
      return
    }
    if (isHierarchyLayout) return
    manuallyPlacedRef.current.clear()
    setPositions(defaultFreePositions)
  }

  const restoreFreeLayout = () => {
    manuallyPlacedRef.current.clear()
    preserveFreePositionsRef.current = true
    setPositions((current) => ({ ...current, ...positions }))
    onLayoutModeChange('free')
  }

  const toggleHierarchyLayout = () => {
    if (isHierarchyLayout) {
      restoreFreeLayout()
      return
    }
    setPan({ x: 0, y: 0 })
    setZoom(1)
    onLayoutModeChange('hierarchy')
  }

  const toggleRingLayout = () => {
    if (isRingLayout) {
      restoreFreeLayout()
      return
    }
    resetRotation()
    onLayoutModeChange('ring')
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    setIsInteracting(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = { kind: 'pan', lastX: event.clientX, lastY: event.clientY }
    onSelectPerson(undefined)
    onSelectRelationship(undefined)
  }

  const handleNodePointerDown = (event: PointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation()
    if (event.button !== 0) return
    setIsInteracting(true)
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
    interactionRef.current = {
      kind: 'node', id, lastX: event.clientX, lastY: event.clientY,
      startX: event.clientX, startY: event.clientY, moved: false,
      deselectOnRelease: isRingLayout && selectedPersonId === id,
    }
    onSelectPerson(id)
    onSelectRelationship(undefined)
  }

  const handleConnectionPointerDown = (
    event: PointerEvent<SVGGElement>,
    sourcePersonId: string,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) return
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
    const source = positions[sourcePersonId]
    if (!source) return
    setIsInteracting(true)
    interactionRef.current = { kind: 'connect', sourcePersonId }
    setConnectionPreview({
      sourcePersonId,
      pointer: { x: source.x + 56, y: source.y },
    })
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current
    if (!interaction) return
    if (interaction.kind === 'connect') {
      const rect = event.currentTarget.getBoundingClientRect()
      const pointer = {
        x: (event.clientX - rect.left - pan.x) / zoom,
        y: (event.clientY - rect.top - pan.y) / zoom,
      }
      const targetPersonId = findConnectionTarget(
        interaction.sourcePersonId,
        pointer,
        visiblePositions,
      )
      interaction.targetPersonId = targetPersonId
      setConnectionPreview({
        sourcePersonId: interaction.sourcePersonId,
        pointer,
        targetPersonId,
      })
      return
    }
    const deltaX = event.clientX - interaction.lastX
    const deltaY = event.clientY - interaction.lastY
    interaction.lastX = event.clientX
    interaction.lastY = event.clientY
    if (interaction.kind === 'pan') {
      setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }))
    } else {
      if (Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY) > 3) {
        interaction.moved = true
      }
      // Automatic layouts stay active until the user explicitly chooses free layout.
      if (layoutMode !== 'free' || !interaction.moved) return
      manuallyPlacedRef.current.add(interaction.id)
      setPositions((current) => ({
        ...current,
        [interaction.id]: {
          x: (current[interaction.id]?.x ?? 0) + deltaX / zoom,
          y: (current[interaction.id]?.y ?? 0) + deltaY / zoom,
        },
      }))
    }
  }

  const finishPointerInteraction = (shouldCreateRelationship: boolean) => {
    const interaction = interactionRef.current
    if (shouldCreateRelationship && interaction?.kind === 'node'
      && interaction.deselectOnRelease && !interaction.moved) {
      onSelectPerson(undefined)
    }
    if (
      shouldCreateRelationship &&
      interaction?.kind === 'connect' &&
      interaction.targetPersonId
    ) {
      onRequestRelationship(interaction.sourcePersonId, interaction.targetPersonId)
    }
    interactionRef.current = null
    setIsInteracting(false)
    setConnectionPreview(undefined)
  }

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (event.deltaY > 0 ? 0.9 : 1.1)))
    const worldX = (cursor.x - pan.x) / zoom
    const worldY = (cursor.y - pan.y) / zoom
    setPan({ x: cursor.x - worldX * nextZoom, y: cursor.y - worldY * nextZoom })
    setZoom(nextZoom)
  }

  const changeZoom = (factor: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor)))
  }

  return (
    <div className={`graph graph--${layoutMode}`} ref={containerRef}>
      {people.length === 0 ? (
        <div className="graph-empty">
          <div className="graph-empty__illustration" aria-hidden="true"><i /><i /><i /></div>
          <p className="eyebrow">从第一个节点开始</p>
          <h2>还没有人物</h2>
          <p>添加人物后，就可以连接他们之间的家庭或同事关系。</p>
          <button className="button button--primary" type="button" onClick={onCreatePerson}>添加第一个人物</button>
        </div>
      ) : (
        <svg
          className="graph__svg"
          width="100%"
          height="100%"
          aria-label={`关系图谱，当前显示 ${visiblePeople.length} 个人物、${displayRelationships.length} 条关系连线`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => finishPointerInteraction(true)}
          onPointerCancel={() => finishPointerInteraction(false)}
          onLostPointerCapture={() => finishPointerInteraction(false)}
          onWheel={handleWheel}
        >
          <defs>
            <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="7" stdDeviation="8" floodOpacity="0.12" />
            </filter>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {isRingLayout && visiblePeople.length > 1 && (
              <circle
                className="graph-ring-guide"
                cx={ringGeometry.center.x}
                cy={ringGeometry.center.y}
                r={ringGeometry.radius}
                aria-hidden="true"
              />
            )}
            {isHierarchyLayout && hierarchyGuides.map((guide) => (
              <g className="graph-level-guide" key={guide.level} aria-hidden="true">
                <line x1="34" y1={guide.y} x2={Math.max(34, size.width - 34)} y2={guide.y} />
                <text x="42" y={guide.y - 10}>等级 {guide.level}</text>
              </g>
            ))}
            {connectionPreview && positions[connectionPreview.sourcePersonId] && (
              <line
                className={`connection-preview${connectionPreview.targetPersonId ? ' has-target' : ''}`}
                x1={positions[connectionPreview.sourcePersonId].x + 45}
                y1={positions[connectionPreview.sourcePersonId].y}
                x2={connectionPreview.targetPersonId
                  ? positions[connectionPreview.targetPersonId]?.x ?? connectionPreview.pointer.x
                  : connectionPreview.pointer.x}
                y2={connectionPreview.targetPersonId
                  ? positions[connectionPreview.targetPersonId]?.y ?? connectionPreview.pointer.y
                  : connectionPreview.pointer.y}
              />
            )}
            {displayRelationships.map((displayRelationship) => {
              const { relationship } = displayRelationship
              const source = positions[relationship.sourcePersonId]
              const target = positions[relationship.targetPersonId]
              if (!source || !target) return null
              const dx = target.x - source.x
              const dy = target.y - source.y
              const length = Math.max(Math.hypot(dx, dy), 1)
              const unitX = dx / length
              const unitY = dy / length
              const start = { x: source.x + unitX * 42, y: source.y + unitY * 42 }
              const end = { x: target.x - unitX * 47, y: target.y - unitY * 47 }
              const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
              const isSelected = selectedRelationshipId
                ? displayRelationship.relationshipIds.includes(selectedRelationshipId)
                : false
              const labelWidth = Math.max(54, displayRelationship.label.length * 12 + 20)
              return (
                <g
                  className={`graph-edge${isSelected ? ' is-selected' : ''}`}
                  key={relationship.id}
                  role="button"
                  tabIndex={0}
                  aria-label={displayRelationship.label}
                  aria-pressed={isSelected}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    onSelectRelationship(isRingLayout && isSelected ? undefined : relationship.id)
                    onSelectPerson(undefined)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectRelationship(isRingLayout && isSelected ? undefined : relationship.id)
                      onSelectPerson(undefined)
                    }
                  }}
                >
                  <line className="graph-edge__hitbox" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                  <line
                    className="graph-edge__line"
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                  />
                  <g transform={`translate(${middle.x} ${middle.y})`}>
                    <rect className="graph-edge__label-bg" x={-labelWidth / 2} y="-13" width={labelWidth} height="26" rx="13" />
                    <text className="graph-edge__label" textAnchor="middle" dominantBaseline="central">
                      {displayRelationship.label}
                    </text>
                  </g>
                </g>
              )
            })}
            {visiblePeople.map((person) => {
              const position = positions[person.id]
              if (!position) return null
              const selected = selectedPersonId === person.id
              const isConnectionTarget = connectionPreview?.targetPersonId === person.id
              return (
                <g
                  key={person.id}
                  className={`graph-node graph-node--${person.gender}${selected ? ' is-selected' : ''}${isConnectionTarget ? ' is-connection-target' : ''}`}
                  transform={`translate(${position.x} ${position.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${person.name}，${person.gender === 'male' ? '男' : '女'}`}
                  aria-pressed={selected}
                  onPointerDown={(event) => handleNodePointerDown(event, person.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectPerson(isRingLayout && selected ? undefined : person.id)
                      onSelectRelationship(undefined)
                    }
                  }}
                >
                  <circle className="graph-node__halo" r="48" />
                  <circle className="graph-node__body" r="36" filter="url(#node-shadow)" />
                  <text className="graph-node__symbol" textAnchor="middle" y="-6">
                    {person.gender === 'male' ? '♂' : '♀'}
                  </text>
                  <text className="graph-node__name" textAnchor="middle" y="16">
                    {person.name.length > 7 ? `${person.name.slice(0, 7)}…` : person.name}
                  </text>
                  {selected && visiblePeople.length > 1 && (
                    <g
                      className="graph-node__connection-handle"
                      transform="translate(51 0)"
                      aria-label={`从${person.name}拖拽创建关系`}
                      onPointerDown={(event) => handleConnectionPointerDown(event, person.id)}
                    >
                      <circle className="graph-node__connection-handle-ring" r="13" />
                      <circle className="graph-node__connection-handle-dot" r="8" />
                      <path d="M -3 0 H 3 M 0 -3 V 3" />
                    </g>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      )}
      {people.length > 0 && (
        <>
          <GraphVisibilityFilters
            variant="flat"
            visibilityFilters={visibilityFilters}
            onToggleGender={onToggleGender}
            onToggleRelationships={onToggleRelationships}
            onToggleRelationshipType={onToggleRelationshipType}
          />
          <div className="graph-controls" aria-label="画布控制">
            <div className="graph-controls__layouts" role="group" aria-label="平面排列方式">
              <button
                className="graph-controls__hierarchy"
                type="button"
                aria-pressed={isHierarchyLayout}
                onClick={toggleHierarchyLayout}
              >
                {isHierarchyLayout ? '恢复自由排列' : '按等级排列'}
              </button>
              <button type="button" aria-pressed={isRingLayout} onClick={toggleRingLayout}>
                {isRingLayout ? '退出圆环排列' : '按圆环排列'}
              </button>
              {isRingLayout && (
                <button
                  type="button"
                  disabled={hasRingSelection || isInteracting || visiblePeople.length < 2}
                  onClick={togglePause}
                >
                  {hasRingSelection ? '选择中暂停' : visiblePeople.length < 2
                    ? '至少两人旋转' : isPaused ? '继续旋转' : '暂停旋转'}
                </button>
              )}
            </div>
            <div className="graph-controls__viewport">
              <button type="button" onClick={() => changeZoom(1.15)} aria-label="放大">＋</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => changeZoom(0.85)} aria-label="缩小">−</button>
              <button type="button" onClick={resetView}>复位</button>
              <button
                type="button"
                aria-label={isFullscreen ? '退出平面图谱全屏' : '平面图谱全屏'}
                aria-pressed={isFullscreen}
                title={fullscreenError}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? '退出全屏' : '全屏'}
              </button>
            </div>
          </div>
          {fullscreenError && <p className="fullscreen-error" role="alert">{fullscreenError}</p>}
        </>
      )}
      {people.length > 0 && (
        <p className="graph-tip">
          {isHierarchyLayout
            ? '关系变更自动更新等级 · 自由拖动请先点击「恢复自由排列」'
            : isRingLayout
              ? '人物增删自动均分圆环 · 选择时暂停 · 再次点击或点击空白取消选择'
              : '拖动画布平移 · 滚轮缩放 · 选中人物后拖动 ＋ 句柄创建关系'}
        </p>
      )}
    </div>
  )
}
