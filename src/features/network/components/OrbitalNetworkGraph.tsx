import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { Person } from '../../../domain/person'
import type { Relationship } from '../../../domain/relationship'
import { filterRelationshipsByPerson } from '../../relationships/filterRelationships'
import { buildSphereLayout, projectSpherePoint } from '../orbitalLayout'
import { isOrbitalRotationPaused } from '../orbitalRotation'
import { groupRelationshipsForDisplay } from '../relationshipDisplay'
import { useGraphFullscreen } from '../useGraphFullscreen'
import { filterNetworkByVisibility } from '../visibilityFilters'
import {
  GraphVisibilityFilters,
  type GraphVisibilityFilterProps,
} from './GraphVisibilityFilters'

interface OrbitalNetworkGraphProps extends GraphVisibilityFilterProps {
  people: Person[]
  relationships: Relationship[]
  selectedPersonId?: string
  selectedRelationshipId?: string
  onSelectPerson: (id?: string) => void
  onSelectRelationship: (id?: string) => void
  onCreatePerson: () => void
}

const PARTICLE_IDS = Array.from({ length: 84 }, (_, index) => `ambient-${index}`)
const PARTICLE_COLORS = ['#33e4f2', '#557cff', '#8b62ff', '#ff587d', '#f5a33b', '#42dcaa']

export function OrbitalNetworkGraph({
  people,
  relationships,
  selectedPersonId,
  selectedRelationshipId,
  onSelectPerson,
  onSelectRelationship,
  onCreatePerson,
  visibilityFilters,
  onToggleGender,
  onToggleRelationships,
  onToggleRelationshipType,
}: OrbitalNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, fullscreenError, toggleFullscreen } = useGraphFullscreen(containerRef)
  const lastFrameRef = useRef<number | undefined>(undefined)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    lastX: number
    moved: boolean
  } | undefined>(undefined)
  const suppressClickRef = useRef(false)
  const [size, setSize] = useState({ width: 900, height: 620 })
  const [rotation, setRotation] = useState(0.35)
  const [zoom, setZoom] = useState(1)
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredPersonId, setHoveredPersonId] = useState<string>()
  const hasSelection = Boolean(selectedPersonId || selectedRelationshipId)
  const isPaused = isOrbitalRotationPaused({
    isManuallyPaused,
    isDragging,
    selectedPersonId,
    selectedRelationshipId,
  })

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!hasSelection) setIsManuallyPaused(false)
  }, [hasSelection])

  useEffect(() => {
    if (isPaused || people.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lastFrameRef.current = undefined
      return
    }
    let frameId = 0
    const animate = (time: number) => {
      const previous = lastFrameRef.current ?? time
      const delta = Math.min(time - previous, 40)
      lastFrameRef.current = time
      setRotation((current) => current + delta * 0.00011)
      frameId = window.requestAnimationFrame(animate)
    }
    frameId = window.requestAnimationFrame(animate)
    return () => {
      window.cancelAnimationFrame(frameId)
      lastFrameRef.current = undefined
    }
  }, [isPaused, people.length])

  const sphereLayout = useMemo(
    () => buildSphereLayout(people.map((person) => person.id), relationships),
    [people, relationships],
  )
  const ambientLayout = useMemo(() => buildSphereLayout(PARTICLE_IDS), [])
  const radius = Math.max(110, Math.min(size.width, size.height) * 0.34 * zoom)
  const center = { x: size.width / 2, y: size.height / 2 + 12 }
  const projectedPeople = useMemo(() => Object.fromEntries(people.map((person) => [
    person.id,
    projectSpherePoint(sphereLayout[person.id], rotation, radius, center.x, center.y),
  ])), [center.x, center.y, people, radius, rotation, sphereLayout])

  const { visiblePeople, visibleRelationships } = useMemo(
    () => filterNetworkByVisibility(people, relationships, visibilityFilters),
    [people, relationships, visibilityFilters],
  )

  useEffect(() => {
    if (hoveredPersonId && !visiblePeople.some((person) => person.id === hoveredPersonId)) {
      setHoveredPersonId(undefined)
    }
  }, [hoveredPersonId, visiblePeople])

  const sortedPeople = [...visiblePeople].sort(
    (left, right) => projectedPeople[left.id].depth - projectedPeople[right.id].depth,
  )
  const focusedRelationships = useMemo(
    () => filterRelationshipsByPerson(visibleRelationships, selectedPersonId),
    [selectedPersonId, visibleRelationships],
  )
  const displayRelationships = useMemo(
    () => groupRelationshipsForDisplay(focusedRelationships),
    [focusedRelationships],
  )

  const changeZoom = (factor: number) => {
    setZoom((current) => Math.min(1.45, Math.max(0.68, current * factor)))
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    suppressClickRef.current = false
    if (event.target instanceof Element && event.target.closest('.orbital-node, .orbital-edge')) {
      return
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      moved: false,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragState.lastX
    if (Math.abs(event.clientX - dragState.startX) > 3) dragState.moved = true
    dragState.lastX = event.clientX
    setRotation((current) => current + deltaX * 0.009)
  }

  const finishPointerDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return
    suppressClickRef.current = dragState.moved
    dragStateRef.current = undefined
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    changeZoom(Math.exp(-event.deltaY * 0.0012))
  }

  const consumeSuppressedClick = () => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }

  return (
    <div className="orbital-graph" ref={containerRef}>
      {people.length === 0 ? (
        <div className="graph-empty orbital-empty">
          <div className="orbital-empty__core" aria-hidden="true"><i /><i /><i /></div>
          <p className="eyebrow">ORBITAL RELATIONSHIP VIEW</p>
          <h2>等待第一个人物信号</h2>
          <p>添加人物后，关系网络会在星球空间中开始生长。</p>
          <button className="button button--primary" type="button" onClick={onCreatePerson}>添加第一个人物</button>
        </div>
      ) : (
        <svg
          className={`orbital-graph__svg${isDragging ? ' is-dragging' : ''}`}
          width="100%"
          height="100%"
          aria-label={`星球关系图谱，当前显示 ${visiblePeople.length} 个人物、${displayRelationships.length} 条关系连线`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onWheel={handleWheel}
          onClick={(event) => {
            if (consumeSuppressedClick()) {
              event.stopPropagation()
              return
            }
            onSelectPerson(undefined)
            onSelectRelationship(undefined)
          }}
        >
          <defs>
            <radialGradient id="orbital-core" cx="50%" cy="45%" r="55%">
              <stop offset="0" stopColor="#22dbea" stopOpacity="0.34" />
              <stop offset="0.48" stopColor="#126ca1" stopOpacity="0.12" />
              <stop offset="1" stopColor="#06182c" stopOpacity="0" />
            </radialGradient>
            <filter id="orbital-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="orbital-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>

          <circle className="orbital-sphere__aura" cx={center.x} cy={center.y} r={radius * 1.08} fill="url(#orbital-core)" />
          <circle className="orbital-sphere__edge" cx={center.x} cy={center.y} r={radius} />
          <ellipse className="orbital-ring orbital-ring--one" cx={center.x} cy={center.y} rx={radius} ry={radius * 0.25} />
          <ellipse className="orbital-ring orbital-ring--two" cx={center.x} cy={center.y} rx={radius * 0.96} ry={radius * 0.48} transform={`rotate(58 ${center.x} ${center.y})`} />
          <ellipse className="orbital-ring orbital-ring--three" cx={center.x} cy={center.y} rx={radius * 0.92} ry={radius * 0.36} transform={`rotate(-46 ${center.x} ${center.y})`} />

          {PARTICLE_IDS.map((id, index) => {
            const projected = projectSpherePoint(ambientLayout[id], rotation * 0.82, radius * 0.98, center.x, center.y)
            const particleRadius = (index % 9 === 0 ? 3.2 : 1.5) * projected.scale
            return (
              <circle
                key={id}
                className="orbital-particle"
                cx={projected.x}
                cy={projected.y}
                r={particleRadius}
                fill={PARTICLE_COLORS[index % PARTICLE_COLORS.length]}
                opacity={0.18 + ((projected.depth + 1) / 2) * 0.58}
              />
            )
          })}

          {displayRelationships.map((displayRelationship) => {
            const { relationship } = displayRelationship
            const source = projectedPeople[relationship.sourcePersonId]
            const target = projectedPeople[relationship.targetPersonId]
            if (!source || !target) return null
            const selected = selectedRelationshipId
              ? displayRelationship.relationshipIds.includes(selectedRelationshipId)
              : false
            const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
            const labelWidth = Math.max(50, displayRelationship.label.length * 10 + 16)
            return (
              <g
                key={relationship.id}
                className={`orbital-edge${selected ? ' is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={displayRelationship.label}
                aria-pressed={selected}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectRelationship(selected ? undefined : relationship.id)
                  onSelectPerson(undefined)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectRelationship(selected ? undefined : relationship.id)
                    onSelectPerson(undefined)
                  }
                }}
              >
                <line className="orbital-edge__hitbox" x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
                <line
                  className="orbital-edge__line"
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
                {selected && (
                  <g transform={`translate(${midpoint.x} ${midpoint.y})`}>
                    <rect className="orbital-edge__label-bg" x={-labelWidth / 2} y="-11" width={labelWidth} height="22" rx="11" />
                    <text className="orbital-edge__label" textAnchor="middle" dominantBaseline="central">
                      {displayRelationship.label}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {sortedPeople.map((person) => {
            const projected = projectedPeople[person.id]
            const selected = selectedPersonId === person.id
            const nodeRadius = (selected ? 14 : 9) * projected.scale
            const depthOpacity = 0.48 + ((projected.depth + 1) / 2) * 0.52
            const showLabel = selected || hoveredPersonId === person.id
            const labelWidth = Math.max(46, person.name.length * 13 + 18)
            return (
              <g
                key={person.id}
                className={`orbital-node orbital-node--${person.gender}${selected ? ' is-selected' : ''}`}
                transform={`translate(${projected.x} ${projected.y})`}
                opacity={depthOpacity}
                role="button"
                tabIndex={0}
                aria-label={`${person.name}，${person.gender === 'male' ? '男' : '女'}，星球节点`}
                aria-pressed={selected}
                onMouseEnter={() => setHoveredPersonId(person.id)}
                onMouseLeave={() => setHoveredPersonId(undefined)}
                onFocus={() => setHoveredPersonId(person.id)}
                onBlur={() => setHoveredPersonId(undefined)}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectPerson(selected ? undefined : person.id)
                  onSelectRelationship(undefined)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectPerson(selected ? undefined : person.id)
                    onSelectRelationship(undefined)
                  }
                }}
              >
                <circle className="orbital-node__pulse" r={nodeRadius + 6} />
                <circle className="orbital-node__body" r={nodeRadius} filter="url(#orbital-glow)" />
                <circle className="orbital-node__core" r={Math.max(2.5, nodeRadius * 0.38)} />
                {showLabel && (
                  <g className="orbital-node__label" transform={`translate(0 ${-(nodeRadius + 20)})`}>
                    <rect x={-labelWidth / 2} y="-12" width={labelWidth} height="24" rx="12" />
                    <text textAnchor="middle" dominantBaseline="central">{person.name}</text>
                  </g>
                )}
              </g>
            )
          })}

          <g className="orbital-core" transform={`translate(${center.x} ${center.y})`}>
            <circle r="38" />
            <circle className="orbital-core__orbit" r="52" />
            <text textAnchor="middle" y="-3">RELATIONSHIP</text>
            <text textAnchor="middle" y="11">CORE</text>
          </g>
        </svg>
      )}

      {people.length > 0 && (
        <>
          <div className="orbital-status">
            <span className="orbital-status__signal" />
            <div>
              <span>{visiblePeople.length}/{people.length} 人物 · {displayRelationships.length} 连线 · {focusedRelationships.length}/{relationships.length} 关系语义</span>
              <strong>{isPaused ? '已暂停' : '实时旋转'}</strong>
            </div>
          </div>
          <GraphVisibilityFilters
            variant="orbital"
            visibilityFilters={visibilityFilters}
            onToggleGender={onToggleGender}
            onToggleRelationships={onToggleRelationships}
            onToggleRelationshipType={onToggleRelationshipType}
          />
          <div className="orbital-controls" aria-label="星球控制">
            <button
              type="button"
              disabled={hasSelection}
              onClick={() => setIsManuallyPaused((current) => !current)}
            >
              {hasSelection ? '选择中暂停' : isPaused ? '继续旋转' : '暂停旋转'}
            </button>
            <button type="button" onClick={() => changeZoom(1.12)} aria-label="放大星球">＋</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => changeZoom(0.88)} aria-label="缩小星球">−</button>
            <button type="button" onClick={() => { setRotation(0.35); setZoom(1) }}>重置视角</button>
            <button
              type="button"
              aria-label={isFullscreen ? '退出星球图谱全屏' : '星球图谱全屏'}
              aria-pressed={isFullscreen}
              title={fullscreenError}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </button>
          </div>
          {fullscreenError && <p className="fullscreen-error" role="alert">{fullscreenError}</p>}
          <p className="orbital-tip">左右拖动旋转 · 滚轮缩放 · 悬停或点击人物显示名称 · 球体会自动缓慢旋转</p>
        </>
      )}
    </div>
  )
}
