import {
  Lightbulb,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Info,
  ArrowRight,
} from 'lucide-react'

function getInsightBadge(text) {
  const lower = text.toLowerCase()
  if (lower.includes('lead') || lower.includes('highest') || lower.includes('largest') || lower.includes('top')) {
    return {
      icon: ArrowUp,
      type: 'success',
      label: 'Leader',
    }
  }
  if (lower.includes('lowest') || lower.includes('bottom') || lower.includes('smallest') || lower.includes('gap')) {
    return {
      icon: ArrowDown,
      type: 'danger',
      label: 'Lowest',
    }
  }
  if (lower.includes('outlier') || lower.includes('missing') || lower.includes('review') || lower.includes('duplicate')) {
    return {
      icon: AlertTriangle,
      type: 'warning',
      label: 'Notice',
    }
  }
  return {
    icon: Info,
    type: 'info',
    label: 'Insight',
  }
}

export default function InsightsPanel({ insights, hasDataset }) {
  const displayInsights = insights && insights.length > 0
    ? insights
    : [
        'Upload your dataset to automatically extract key statistical trends, leaders, and anomalies.',
      ]

  return (
    <div className="panel key-insights-card" id="insights-panel">
      {/* Header */}
      <div className="insights-card-header">
        <div className="insights-title-group">
          <div className="insights-bulb-icon-box">
            <Lightbulb size={18} className="insights-bulb-icon" />
          </div>
          <h2 className="insights-title">Key Insights</h2>
        </div>
        <button
          type="button"
          className="insights-view-all-link"
          onClick={() => {
            document.getElementById('ai-analyst-panel')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <span>View All</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Insights List */}
      <div className="insights-item-list">
        {displayInsights.map((insight, idx) => {
          const badge = getInsightBadge(insight)
          const Icon = badge.icon
          return (
            <div key={idx} className="insight-bullet-item">
              <div className={`insight-status-circle ${badge.type}`}>
                <Icon size={12} strokeWidth={2.5} />
              </div>
              <p className="insight-text-content">{insight}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
