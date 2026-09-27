import React from 'react'
import { Filter, X, RotateCcw } from 'lucide-react'

export default function DimensionSlicer({
  categorical = [],
  rows = [],
  totalRows = 0,
  activeFilters = {},
  onFilterChange,
  onResetFilters,
}) {
  if (!categorical.length || !rows.length) return null

  // We choose up to 3 primary categorical dimensions for quick slicing
  const primaryDims = categorical.slice(0, 3)

  const activeCount = Object.keys(activeFilters).length

  return (
    <div className="dimension-slicer-container">
      <div className="slicer-header">
        <div className="slicer-title-wrap">
          <Filter size={15} className="slicer-icon" />
          <span className="slicer-title">Interactive Segment Slicer</span>
          {activeCount > 0 && (
            <span className="slicer-active-badge">{activeCount} active filter{activeCount > 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="slicer-stats">
          <span className="slicer-record-count">
            Showing <strong>{rows.length.toLocaleString()}</strong> of {totalRows.toLocaleString()} orders
            {activeCount > 0 && <span className="slicer-filtered-tag"> (Filtered)</span>}
          </span>
          {activeCount > 0 && (
            <button className="slicer-reset-btn" onClick={onResetFilters} title="Clear all active filters">
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="slicer-selectors-row">
        {primaryDims.map((dim) => {
          // Get unique values for this dimension
          const uniqueVals = [...new Set(rows.map((r) => r[dim]).filter(Boolean))].slice(0, 15)
          const currentVal = activeFilters[dim] || 'ALL'

          return (
            <div key={dim} className="slicer-field-group">
              <label className="slicer-label">{dim}</label>
              <select
                value={currentVal}
                onChange={(e) => onFilterChange(dim, e.target.value)}
                className={`slicer-select ${currentVal !== 'ALL' ? 'active-select' : ''}`}
              >
                <option value="ALL">All {dim}s</option>
                {uniqueVals.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>
          )
        })}

        {/* Active Filter Chips */}
        {activeCount > 0 && (
          <div className="slicer-chips-wrap">
            {Object.entries(activeFilters).map(([dim, val]) => (
              <span key={dim} className="slicer-chip">
                <span className="slicer-chip-dim">{dim}:</span>
                <span className="slicer-chip-val">{val}</span>
                <button
                  type="button"
                  className="slicer-chip-remove"
                  onClick={() => onFilterChange(dim, 'ALL')}
                  aria-label={`Remove filter ${dim}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
