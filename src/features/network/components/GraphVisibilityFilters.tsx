import { GENDERS, GENDER_LABELS, type Gender } from '../../../domain/person'
import {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from '../../../domain/relationship'
import type { NetworkVisibilityFilters } from '../visibilityFilters'

export interface GraphVisibilityFilterProps {
  visibilityFilters: NetworkVisibilityFilters
  onToggleGender: (gender: Gender) => void
  onToggleRelationships: () => void
  onToggleRelationshipType: (type: RelationshipType) => void
}

interface GraphVisibilityFiltersProps extends GraphVisibilityFilterProps {
  variant: 'flat' | 'orbital' | 'nebula'
}

export function GraphVisibilityFilters({
  variant,
  visibilityFilters,
  onToggleGender,
  onToggleRelationships,
  onToggleRelationshipType,
}: GraphVisibilityFiltersProps) {
  return (
    <div className={`${variant}-filter-panel graph-visibility-filters`}>
      <div className="orbital-legend" role="group" aria-label="节点和关系显示筛选">
        {GENDERS.map((gender) => (
          <button
            key={gender}
            type="button"
            aria-pressed={visibilityFilters.visibleGenders.has(gender)}
            onClick={() => onToggleGender(gender)}
          >
            <i className={`is-${gender}`} />{GENDER_LABELS[gender]}性
          </button>
        ))}
        <button
          type="button"
          aria-pressed={visibilityFilters.showRelationships}
          onClick={onToggleRelationships}
        >
          <i className="is-relation" />关系
        </button>
      </div>
      <div className="orbital-type-filter-row">
        <span>关系类型</span>
        <div className="orbital-relationship-filters" role="group" aria-label="关系类型显示筛选">
          {RELATIONSHIP_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={visibilityFilters.visibleRelationshipTypes.has(type)}
              onClick={() => onToggleRelationshipType(type)}
            >
              {RELATIONSHIP_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
