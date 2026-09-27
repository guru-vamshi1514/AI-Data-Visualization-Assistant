import { Table2, Hash, Layers, Calendar } from 'lucide-react'

export default function ColumnTypesPanel({ types }) {
  const numeric = types?.numeric || []
  const categorical = types?.categorical || []
  const date = types?.date || []

  const groups = [
    {
      id: 'numeric',
      title: 'Numeric Features',
      count: numeric.length,
      columns: numeric,
      icon: Hash,
      accent: 'cyan',
    },
    {
      id: 'categorical',
      title: 'Categorical Dimensions',
      count: categorical.length,
      columns: categorical,
      icon: Layers,
      accent: 'indigo',
    },
    {
      id: 'date',
      title: 'Date & Time Dimensions',
      count: date.length,
      columns: date,
      icon: Calendar,
      accent: 'purple',
    },
  ]

  return (
    <div className="panel column-types-panel">
      <div className="panel-header-row">
        <div className="panel-title">
          <Table2 size={16} className="panel-title-icon" />
          <div>
            <h2>Attribute Classification</h2>
            <span className="panel-subtitle">Inferred schema & data types</span>
          </div>
        </div>
      </div>

      <div className="column-groups-container">
        {groups.map((group) => {
          const IconComponent = group.icon
          return (
            <div key={group.id} className="column-group-card">
              <div className="column-group-header">
                <div className={`col-type-badge ${group.accent}`}>
                  <IconComponent size={12} />
                  <span>{group.title}</span>
                </div>
                <span className="col-count-tag">{group.count}</span>
              </div>
              <div className="column-pill-list">
                {group.columns.length > 0 ? (
                  group.columns.map((col) => (
                    <span key={col} className="column-chip">
                      {col}
                    </span>
                  ))
                ) : (
                  <span className="col-empty-text">None detected</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
