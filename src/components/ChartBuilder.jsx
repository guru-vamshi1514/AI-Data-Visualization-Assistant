import { Settings, BarChart2, ChevronDown, RotateCcw } from 'lucide-react'

const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart' },
  { id: 'line', label: 'Line Chart' },
  { id: 'area', label: 'Area Chart' },
  { id: 'pie', label: 'Pie Chart' },
  { id: 'scatter', label: 'Scatter Plot' },
  { id: 'histogram', label: 'Histogram' },
  { id: 'heatmap', label: 'Correlation Heatmap' },
  { id: 'box', label: 'Box Plot' },
]

const AGGREGATIONS = [
  { id: 'sum', label: 'Sum' },
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' },
]

export default function ChartBuilder({
  activeChart,
  profile,
  hasDataset,
  onUpdateChart,
  onResetToRecommended,
  isCustom,
}) {
  function handleGenerateClick() {
    // Scrolls to visualization
    document.getElementById('visualization-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="panel manual-chart-builder-card" id="builder-panel">
      {/* Header */}
      <div className="builder-card-header">
        <div className="builder-title-group">
          <Settings size={18} className="builder-gear-icon" />
          <h2 className="builder-title">Manual Chart Builder</h2>
        </div>
        {isCustom && (
          <button
            type="button"
            className="builder-reset-btn"
            onClick={onResetToRecommended}
            title="Reset to recommended chart"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 4 Controls Grid */}
      <div className="builder-controls-row">
        {/* 1. Chart Type */}
        <div className="builder-field">
          <label className="builder-label" htmlFor="chart-type-input">
            Chart Type
          </label>
          <div className="builder-select-container">
            <select
              id="chart-type-input"
              value={activeChart?.type || 'bar'}
              onChange={(e) => onUpdateChart('type', e.target.value)}
              disabled={!hasDataset}
            >
              {CHART_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="builder-select-arrow" />
          </div>
        </div>

        {/* 2. X Axis / Category */}
        <div className="builder-field">
          <label className="builder-label" htmlFor="x-axis-input">
            X Axis / Category
          </label>
          <div className="builder-select-container">
            <select
              id="x-axis-input"
              value={activeChart?.xKey || ''}
              onChange={(e) => onUpdateChart('xKey', e.target.value)}
              disabled={!hasDataset || profile.columnNames.length === 0}
            >
              {profile.columnNames.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="builder-select-arrow" />
          </div>
        </div>

        {/* 3. Y Axis / Metric */}
        <div className="builder-field">
          <label className="builder-label" htmlFor="y-axis-input">
            Y Axis / Metric
          </label>
          <div className="builder-select-container">
            <select
              id="y-axis-input"
              value={activeChart?.yKey || ''}
              onChange={(e) => onUpdateChart('yKey', e.target.value)}
              disabled={!hasDataset || profile.types.numeric.length === 0}
            >
              {profile.types.numeric.length === 0 && (
                <option value="">No numeric columns</option>
              )}
              {profile.types.numeric.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="builder-select-arrow" />
          </div>
        </div>

        {/* 4. Aggregation */}
        <div className="builder-field">
          <label className="builder-label" htmlFor="aggregation-input">
            Aggregation
          </label>
          <div className="builder-select-container">
            <select
              id="aggregation-input"
              value={activeChart?.aggregation || 'sum'}
              onChange={(e) => onUpdateChart('aggregation', e.target.value)}
              disabled={!hasDataset}
            >
              {AGGREGATIONS.map((agg) => (
                <option key={agg.id} value={agg.id}>
                  {agg.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="builder-select-arrow" />
          </div>
        </div>
      </div>

      {/* Prominent Generate Chart Button */}
      <button
        type="button"
        className="builder-generate-submit-btn"
        onClick={handleGenerateClick}
        disabled={!hasDataset}
      >
        <BarChart2 size={18} />
        <span>Generate Chart</span>
      </button>
    </div>
  )
}
