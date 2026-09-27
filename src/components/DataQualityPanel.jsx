import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'

export default function DataQualityPanel({
  cleaningReport,
  profile,
  hasDataset,
}) {
  const missingCount = cleaningReport?.missingTotal || 0
  const duplicateCount = cleaningReport?.duplicateRows || 0
  const outlierCount = profile?.outliers?.length || 0
  const categoryIssues = cleaningReport?.inconsistentCategories?.length || 0
  const totalRows = Math.max(profile?.rows || 1, 1)

  const missingPercent = ((missingCount / (totalRows * Math.max(profile?.columns || 1, 1))) * 100).toFixed(0)
  const duplicatePercent = ((duplicateCount / totalRows) * 100).toFixed(0)

  const isClean = missingCount === 0 && duplicateCount === 0 && outlierCount === 0 && categoryIssues === 0
  const isExcellent = missingCount === 0 && duplicateCount === 0 && categoryIssues === 0

  const qualityItems = [
    {
      id: 'missing',
      label: 'Missing values',
      count: missingCount,
      percent: `${missingPercent}%`,
      status: missingCount === 0 ? 'good' : 'warning',
    },
    {
      id: 'duplicates',
      label: 'Duplicate rows',
      count: duplicateCount,
      percent: `${duplicatePercent}%`,
      status: duplicateCount === 0 ? 'good' : 'warning',
    },
    {
      id: 'outliers',
      label: 'Outlier columns',
      count: outlierCount,
      status: outlierCount === 0 ? 'good' : 'warning',
    },
    {
      id: 'categories',
      label: 'Category issues',
      count: categoryIssues,
      status: categoryIssues === 0 ? 'good' : 'warning',
    },
  ]

  return (
    <div className="panel data-quality-card" id="quality-panel">
      {/* Header */}
      <div className="quality-card-header">
        <div className="quality-title-group">
          <ShieldCheck size={18} className="quality-shield-icon" />
          <h2 className="quality-title">Data Quality</h2>
        </div>
        <div className={`quality-rating-badge ${isClean || isExcellent ? 'excellent' : 'warning'}`}>
          <span className="check-mark">✓</span>
          <span>{isClean || isExcellent ? 'Excellent' : 'Needs Review'}</span>
        </div>
      </div>

      {/* Rows */}
      <div className="quality-rows-list">
        {qualityItems.map((item) => {
          const isGood = item.status === 'good'
          return (
            <div key={item.id} className="quality-row-item">
              <div className="quality-item-left">
                {isGood ? (
                  <CheckCircle2 size={16} className="quality-status-icon good" />
                ) : (
                  <AlertCircle size={16} className="quality-status-icon warning" />
                )}
                <span className="quality-item-name">{item.label}</span>
              </div>

              <div className="quality-item-right">
                <span className="quality-metric-number">{hasDataset ? item.count : 0}</span>
                {item.percent !== undefined && (
                  <span className="quality-metric-percent">
                    {hasDataset ? item.percent : '0%'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
