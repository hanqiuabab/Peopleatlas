import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { Person } from '../../../domain/person'
import type { Relationship, RelationshipType } from '../../../domain/relationship'
import { filterRelationshipsByPerson } from '../../relationships/filterRelationships'
import { buildNebulaLayout } from '../nebulaLayout'
import { groupRelationshipsForDisplay } from '../relationshipDisplay'
import { useGraphFullscreen } from '../useGraphFullscreen'
import { filterNetworkByVisibility } from '../visibilityFilters'
import {
  GraphVisibilityFilters,
  type GraphVisibilityFilterProps,
} from './GraphVisibilityFilters'

interface NebulaNetworkGraphProps extends GraphVisibilityFilterProps {
  people: Person[]
  relationships: Relationship[]
  selectedPersonId?: string
  selectedRelationshipId?: string
  onSelectPerson: (id?: string) => void
  onSelectRelationship: (id?: string) => void
  onCreatePerson: () => void
}

interface AmbientStar {
  id: number
  x: number
  y: number
  radius: number
  opacity: number
  color: string
}

const STAR_COLORS = ['#4ae4ef', '#6688ff', '#ae73ff', '#ff6590', '#f6b54d', '#54e1ad']

function fraction(value: number) {
  return value - Math.floor(value)
}

const AMBIENT_STARS: AmbientStar[] = Array.from({ length: 132 }, (_, index) => ({
  id: index,
  x: fraction(Math.sin((index + 1) * 12.9898) * 43758.5453),
  y: fraction(Math.sin((index + 17) * 78.233) * 19341.137),
  radius: index % 17 === 0 ? 2.2 : index % 7 === 0 ? 1.45 : 0.8,
  opacity: 0.16 + fraction(Math.sin((index + 9) * 44.17) * 9182.33) * 0.5,
  color: STAR_COLORS[index % STAR_COLORS.length],
}))

const EDGE_COLORS: Record<RelationshipType, string> = {
  father: '#6f9eff',
  mother: '#ff709d',
  husband: '#f4b555',
  wife: '#f4b555',
  son: '#50c9ff',
  daughter: '#f792c6',
  older_brother: '#8978ff',
  older_sister: '#c17cff',
  younger_brother: '#58d7db',
  younger_sister: '#df7fd7',
  colleague: '#4ce0ad',
}

function createCurvePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  bend: number,
) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const controlX = (source.x + target.x) / 2 - (dy / distance) * bend
  const controlY = (source.y + target.y) / 2 + (dx / distance) * bend
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`
}

export function NebulaNetworkGraph({
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
}: NebulaNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, fullscreenError, toggleFullscreen } = useGraphFullscreen(containerRef)
  const lastFrameRef = useRef<number | undefined>(undefined)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
  } | undefined>(undefined)
  const suppressClickRef = useRef(false)
  const [size, setSize] = useState({ width: 900, height: 620 })
  const [rotation, setRotation] = useState(-0.12)
  const [verticalOffset, setVerticalOffset] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [isManuallyPaused, setIsManuallyPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredPersonId, setHoveredPersonId] = useState<string>()
  const hasSelection = Boolean(selectedPersonId || selectedRelationshipId)
  const isPaused = isManuallyPaused || isDragging || hasSelection

  const { visiblePeople, visibleRelationships } = useMemo(
    () => filterNetworkByVisibility(people, relationships, visibilityFilters),
    [people, relationships, visibilityFilters],
  )
  const allDisplayRelationships = useMemo(
    () => groupRelationshipsForDisplay(relationships),
    [relationships],
  )
  const degreeByPerson = useMemo(() => {
    const degrees = new Map<string, number>()
    allDisplayRelationships.forEach(({ relationship }) => {
      degrees.set(relationship.sourcePersonId, (degrees.get(relationship.sourcePersonId) ?? 0) + 1)
      degrees.set(relationship.targetPersonId, (degrees.get(relationship.targetPersonId) ?? 0) + 1)
    })
    return degrees
  }, [allDisplayRelationships])
  const orderedPeople = useMemo(() => [...visiblePeople].sort((left, right) => (
    (degreeByPerson.get(right.id) ?? 0) - (degreeByPerson.get(left.id) ?? 0)
    || left.id.localeCompare(right.id)
  )), [degreeByPerson, visiblePeople])
  const nebulaLayout = useMemo(
    () => buildNebulaLayout(orderedPeople.map((person) => person.id), relationships),
    [orderedPeople, relationships],
  )
  const focusedRelationships = useMemo(
    () => filterRelationshipsByPerson(visibleRelationships, selectedPersonId),
    [selectedPersonId, visibleRelationships],
  )
  const displayRelationships = useMemo(
    () => groupRelationshipsForDisplay(focusedRelationships),
    [focusedRelationships],
  )

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
      setRotation((current) => current + delta * 0.000035)
      frameId = window.requestAnimationFrame(animate)
    }
    frameId = window.requestAnimationFrame(animate)
    return () => {
      window.cancelAnimationFrame(frameId)
      lastFrameRef.current = undefined
    }
  }, [isPaused, people.length])

  useEffect(() => {
    if (hoveredPersonId && !visiblePeople.some((person) => person.id === hoveredPersonId)) {
      setHoveredPersonId(undefined)
    }
  }, [hoveredPersonId, visiblePeople])

  const center = { x: size.width / 2, y: size.height / 2 + verticalOffset }
  const projectedPeople = useMemo(() => {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const spreadX = Math.max(150, size.width * 0.39) * zoom
    const spreadY = Math.max(130, size.height * 0.36) * zoom

    return Object.fromEntries(orderedPeople.map((person) => {
      const point = nebulaLayout[person.id]
      const rotatedX = point.x * cos - point.y * sin
      const rotatedY = point.x * sin + point.y * cos
      const scale = 0.88 + ((point.depth + 1) / 2) * 0.22
      return [person.id, {
        x: center.x + rotatedX * spreadX,
        y: center.y + rotatedY * spreadY,
        scale,
        depth: point.depth,
      }]
    }))
  }, [center.x, center.y, nebulaLayout, orderedPeople, rotation, size.height, size.width, zoom])

  const peopleByDepth = useMemo(() => [...orderedPeople].sort((left, right) => (
    projectedPeople[left.id].depth - projectedPeople[right.id].depth
  )), [orderedPeople, projectedPeople])
  const labelPersonIds = useMemo(() => new Set(
    orderedPeople
      .slice(0, orderedPeople.length <= 16 ? orderedPeople.length : Math.max(8, Math.ceil(orderedPeople.length * 0.2)))
      .map((person) => person.id),
  ), [orderedPeople])
  const ranking = orderedPeople.slice(0, 4)

  const changeZoom = (factor: number) => {
    setZoom((current) => Math.min(2.1, Math.max(0.48, current * factor)))
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    suppressClickRef.current = false
    if (event.target instanceof Element && event.target.closest('.nebula-node, .nebula-edge')) return
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const deltaX = event.clientX - dragState.lastX
    const deltaY = event.clientY - dragState.lastY
    if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 3) {
      dragState.moved = true
    }
    dragState.lastX = event.clientX
    dragState.lastY = event.clientY
    setRotation((current) => current + deltaX * 0.0055)
    setVerticalOffset((current) => Math.max(-130, Math.min(130, current + deltaY)))
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
    changeZoom(Math.exp(-event.deltaY * 0.00115))
  }

  const resetView = () => {
    setRotation(-0.12)
    setVerticalOffset(0)
    setZoom(1)
  }

  return (
    <div className="nebula-graph" ref={containerRef}>
      {people.length === 0 ? (
        <div className="graph-empty nebula-empty">
          <div className="nebula-empty__cloud" aria-hidden="true"><i /><i /><i /><i /></div>
          <p className="eyebrow">NEBULA RELATIONSHIP VIEW</p>
          <h2>等待第一颗关系星辰</h2>
          <p>添加人物后，关系会以星云节点和发光丝线在这里生长。</p>
          <button className="button button--primary" type="button" onClick={onCreatePerson}>添加第一个人物</button>
        </div>
      ) : (
        <svg
          className={`nebula-graph__svg${isDragging ? ' is-dragging' : ''}`}
          width="100%"
          height="100%"
          aria-label={`星云关系图谱，当前显示 ${visiblePeople.length} 个人物、${displayRelationships.length} 条关系连线`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onWheel={handleWheel}
          onClick={(event) => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              event.stopPropagation()
              return
            }
            onSelectPerson(undefined)
            onSelectRelationship(undefined)
          }}
        >
          <defs>
            <radialGradient id="nebula-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#49eaf1" stopOpacity="0.28" />
              <stop offset="0.35" stopColor="#2e6cff" stopOpacity="0.12" />
              <stop offset="1" stopColor="#071126" stopOpacity="0" />
            </radialGradient>
            <filter id="nebula-node-glow" x="-180%" y="-180%" width="460%" height="460%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="nebula-line-glow" x="-30%" y="-100%" width="160%" height="300%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <ellipse
            className="nebula-core-aura"
            cx={center.x}
            cy={center.y}
            rx={Math.max(180, size.width * 0.32) * zoom}
            ry={Math.max(130, size.height * 0.27) * zoom}
            fill="url(#nebula-core-glow)"
          />

          <g className="nebula-stars" aria-hidden="true">
            {AMBIENT_STARS.map((star) => (
              <circle
                key={star.id}
                cx={star.x * size.width + Math.sin(rotation + star.id) * 7}
                cy={star.y * size.height + verticalOffset * 0.08}
                r={star.radius}
                fill={star.color}
                opacity={star.opacity}
                style={{ animationDelay: `${-(star.id % 13) * 0.28}s` }}
              />
            ))}
          </g>

          <g className="nebula-filaments" aria-hidden="true">
            {peopleByDepth.flatMap((person, personIndex) => {
              const point = projectedPeople[person.id]
              const degree = degreeByPerson.get(person.id) ?? 0
              return Array.from({ length: 7 }, (_, rayIndex) => {
                const angle = rotation * 0.25 + personIndex * 1.17 + rayIndex * 0.91
                const length = (28 + ((personIndex * 19 + rayIndex * 13) % 58) + degree * 4) * zoom
                return (
                  <line
                    key={`${person.id}-ray-${rayIndex}`}
                    x1={point.x}
                    y1={point.y}
                    x2={point.x + Math.cos(angle) * length}
                    y2={point.y + Math.sin(angle) * length * 0.62}
                  />
                )
              })
            })}
          </g>

          {displayRelationships.map((displayRelationship, edgeIndex) => {
            const { relationship } = displayRelationship
            const source = projectedPeople[relationship.sourcePersonId]
            const target = projectedPeople[relationship.targetPersonId]
            if (!source || !target) return null
            const selected = selectedRelationshipId
              ? displayRelationship.relationshipIds.includes(selectedRelationshipId)
              : false
            const bend = (edgeIndex % 2 === 0 ? 1 : -1) * (11 + (edgeIndex % 3) * 7)
            const path = createCurvePath(source, target, bend)
            const midpoint = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
            const labelWidth = Math.max(50, displayRelationship.label.length * 10 + 18)
            const color = EDGE_COLORS[relationship.type]
            return (
              <g
                key={relationship.id}
                className={`nebula-edge${selected ? ' is-selected' : ''}`}
                style={{ color }}
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
                <path className="nebula-edge__hitbox" d={path} />
                <path className="nebula-edge__fiber nebula-edge__fiber--outer" d={createCurvePath(source, target, bend + 7)} />
                <path className="nebula-edge__fiber" d={path} />
                <path className="nebula-edge__fiber nebula-edge__fiber--inner" d={createCurvePath(source, target, bend - 6)} />
                {selected && (
                  <g className="nebula-edge__label" transform={`translate(${midpoint.x} ${midpoint.y})`}>
                    <rect x={-labelWidth / 2} y="-12" width={labelWidth} height="24" rx="12" />
                    <text textAnchor="middle" dominantBaseline="central">{displayRelationship.label}</text>
                  </g>
                )}
              </g>
            )
          })}

          {peopleByDepth.map((person) => {
            const point = projectedPeople[person.id]
            const degree = degreeByPerson.get(person.id) ?? 0
            const selected = selectedPersonId === person.id
            const hovered = hoveredPersonId === person.id
            const radius = (6.5 + Math.min(8, Math.sqrt(degree + 1) * 2.6)) * point.scale
            const showLabel = selected || hovered || labelPersonIds.has(person.id)
            return (
              <g
                key={person.id}
                className={`nebula-node nebula-node--${person.gender}${selected ? ' is-selected' : ''}`}
                transform={`translate(${point.x} ${point.y})`}
                opacity={0.62 + ((point.depth + 1) / 2) * 0.38}
                role="button"
                tabIndex={0}
                aria-label={`${person.name}，${person.gender === 'male' ? '男' : '女'}，星云节点`}
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
                <circle className="nebula-node__halo" r={radius + 9 + degree} />
                <circle className="nebula-node__selection" r={radius + 5} />
                <circle className="nebula-node__body" r={radius} filter="url(#nebula-node-glow)" />
                <circle className="nebula-node__core" r={Math.max(2.2, radius * 0.32)} />
                {showLabel && (
                  <text
                    className="nebula-node__label"
                    x={radius + 7}
                    y={-radius - 3}
                    style={{ fontSize: `${Math.min(16, 10 + degree * 0.7)}px` }}
                  >
                    {person.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {people.length > 0 && (
        <>
          <div className="nebula-status">
            <span className="nebula-status__signal" />
            <div>
              <span>NEBULA NETWORK</span>
              <strong>{visiblePeople.length} 节点 · {displayRelationships.length} 关系丝线</strong>
            </div>
          </div>
          <GraphVisibilityFilters
            variant="nebula"
            visibilityFilters={visibilityFilters}
            onToggleGender={onToggleGender}
            onToggleRelationships={onToggleRelationships}
            onToggleRelationshipType={onToggleRelationshipType}
          />
          {ranking.length > 0 && (
            <div className="nebula-ranking" aria-label="连接度排名">
              <span>连接度</span>
              {ranking.map((person, index) => (
                <div key={person.id}>
                  <i className={`is-${person.gender}`} />
                  <strong>{index + 1}</strong>
                  <span>{person.name}</span>
                  <b>{degreeByPerson.get(person.id) ?? 0}</b>
                </div>
              ))}
            </div>
          )}
          <div className="nebula-controls" aria-label="星云控制">
            <button
              type="button"
              disabled={hasSelection}
              onClick={() => setIsManuallyPaused((current) => !current)}
            >
              {hasSelection ? '选择中暂停' : isPaused ? '继续漂移' : '暂停漂移'}
            </button>
            <button type="button" onClick={() => changeZoom(1.15)} aria-label="放大星云">＋</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => changeZoom(0.86)} aria-label="缩小星云">−</button>
            <button type="button" onClick={resetView}>重置视角</button>
            <button
              type="button"
              aria-label={isFullscreen ? '退出星云图谱全屏' : '星云图谱全屏'}
              aria-pressed={isFullscreen}
              title={fullscreenError}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </button>
          </div>
          {fullscreenError && <p className="fullscreen-error" role="alert">{fullscreenError}</p>}
          <p className="nebula-tip">拖动探索星云 · 滚轮缩放 · 点击人物聚焦关系 · 节点大小代表连接度</p>
        </>
      )}
    </div>
  )
}
