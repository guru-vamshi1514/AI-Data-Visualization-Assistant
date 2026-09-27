import { useState } from 'react'
import {
  BarChart3,
  LineChart,
  PieChart,
  ScatterChart,
  ArrowRight,
  TrendingUp,
  Layers,
  ChevronUp,
} from 'lucide-react'

function getRecommendationTheme(chart, index) {
  const type = chart?.type || 'bar'
  if (type === 'line') {
    return {
      icon: LineChart,
      color: 'blue',
      btnClass: 'btn-blue',
    }
  }
  if (type === 'pie') {
    return {
      icon: PieChart,
      color: 'purple',
      btnClass: 'btn-purple',
    }
  }
  if (type === 'scatter') {
    return {
      icon: ScatterChart,
      color: 'amber',
      btnClass: 'btn-amber',
    }
  }
  if (type === 'heatmap') {
    return {
      icon: Layers,
      color: 'purple',
      btnClass: 'btn-purple',
    }
  }
  if (type === 'box') {
    return {
      icon: TrendingUp,
      color: 'green',
      btnClass: 'btn-green',
    }
  }
  if (type === 'histogram') {
    return {
      icon: BarChart3,
      color: 'amber',
      btnClass: 'btn-amber',
    }
  }
  // Default bar / fallback by index
  if (index === 1) {
    return {
      icon: BarChart3,
      color: 'green',
      btnClass: 'btn-green',
    }
  }
  return {
    icon: BarChart3,
    color: 'blue',
    btnClass: 'btn-blue',
  }
}

export default function Recommendations({
  recommendations,
  selectedIndex,
  onSelectRecommendation,
  isManualActive,
  hasDataset,
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const defaultRecs = [
    {
      type: 'line',
      title: 'Sales Trend by Date',
      reason: 'Show how sales change over time.',
    },
    {
      type: 'bar',
      title: 'Sales by Category',
      reason: 'Compare sales across categories.',
    },
    {
      type: 'pie',
      title: 'Quantity Distribution',
      reason: 'Show distribution of quantity values.',
    },
    {
      type: 'scatter',
      title: 'Sales vs Quantity',
      reason: 'Explore correlation between sales and quantity.',
    },
  ]

  const allRecs = recommendations && recommendations.length > 0 ? recommendations : defaultRecs
  const displayRecs = isExpanded ? allRecs : allRecs.slice(0, 4)
  const canExpand = allRecs.length > 4

  function handleViewAllClick() {
    setIsExpanded((prev) => !prev)
  }

  function handleGenerateChart(idx) {
    onSelectRecommendation(idx)
    document.getElementById('visualization-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={`panel chart-recommendations-card ${isExpanded ? 'is-expanded' : ''}`} id="recommendations-panel">
      {/* Header */}
      <div className="rec-section-header">
        <div className="rec-title-block">
          <div className="rec-header-top">
            <BarChart3 size={18} className="rec-bar-icon" />
            <h2 className="rec-section-title">Chart Recommendations</h2>
          </div>
          <p className="rec-section-sub">
            {hasDataset
              ? `Based on your data, we recommend these ${allRecs.length} visualizations:`
              : 'Upload a CSV dataset to generate contextual chart recommendations:'}
          </p>
        </div>
        {canExpand && (
          <button
            type="button"
            className="rec-view-all-link"
            onClick={handleViewAllClick}
            aria-expanded={isExpanded}
            title={isExpanded ? 'Show fewer recommendations' : `View all ${allRecs.length} recommendations`}
          >
            <span>{isExpanded ? 'Show Less' : `View All (${allRecs.length})`}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ArrowRight size={13} />}
          </button>
        )}
      </div>

      {/* Grid of Cards (expands smoothly when viewing all) */}
      <div className="rec-cards-grid">
        {displayRecs.map((chart, idx) => {
          const theme = getRecommendationTheme(chart, idx)
          const Icon = theme.icon
          const isSelected = hasDataset && !isManualActive && selectedIndex === idx

          return (
            <div
              key={`${chart.type}-${chart.title}-${idx}`}
              className={`rec-item-card ${theme.color} ${isSelected ? 'active-rec' : ''}`}
            >
              <div className="rec-card-top-row">
                <div className={`rec-icon-wrapper ${theme.color}`}>
                  <Icon size={18} />
                </div>
                <div className="rec-card-info">
                  <strong className="rec-card-title">{chart.title}</strong>
                  <p className="rec-card-desc">{chart.reason}</p>
                </div>
              </div>

              <button
                type="button"
                className={`rec-generate-btn ${theme.btnClass}`}
                onClick={() => handleGenerateChart(idx)}
                disabled={!hasDataset}
                title={`Generate ${chart.title}`}
              >
                <span>{isSelected ? 'Viewing Chart' : 'Generate Chart'}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
