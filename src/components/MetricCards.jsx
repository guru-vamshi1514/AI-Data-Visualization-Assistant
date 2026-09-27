import {
  Database,
  LayoutGrid,
  BarChart2,
  Tag,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react'

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    notation: Math.abs(Number(value)) > 99999 ? 'compact' : 'standard',
  }).format(Number(value) || 0)
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MetricCards({
  profile,
  cleaningReport,
  hasDataset,
  fileName,
  fileSizeBytes,
}) {
  const missingCount = cleaningReport?.missingTotal || 0
  const dimensionsCount =
    (profile?.types?.categorical?.length || 0) + (profile?.types?.date?.length || 0)
  const numericCount = profile?.types?.numeric?.length || 0

  return (
    <section className="metrics-row-container" aria-label="Summary Metrics">
      {/* 1. Rows */}
      <div className="summary-metric-card card-rows">
        <div className="metric-icon-box blue">
          <Database size={20} />
        </div>
        <div className="metric-info-col">
          <span className="metric-title-label">Rows</span>
          <strong className="metric-big-value">
            {formatNumber(profile?.rows || 0)}
          </strong>
          <span className="metric-explanation">Total records</span>
        </div>
      </div>

      {/* 2. Columns */}
      <div className="summary-metric-card card-columns">
        <div className="metric-icon-box green">
          <LayoutGrid size={20} />
        </div>
        <div className="metric-info-col">
          <span className="metric-title-label">Columns</span>
          <strong className="metric-big-value">
            {formatNumber(profile?.columns || 0)}
          </strong>
          <span className="metric-explanation">Total features</span>
        </div>
      </div>

      {/* 3. Numeric Metrics */}
      <div className="summary-metric-card card-numeric">
        <div className="metric-icon-box orange">
          <BarChart2 size={20} />
        </div>
        <div className="metric-info-col">
          <span className="metric-title-label">Numeric Metrics</span>
          <strong className="metric-big-value">
            {formatNumber(numericCount)}
          </strong>
          <span className="metric-explanation">Numeric columns</span>
        </div>
      </div>

      {/* 4. Dimensions */}
      <div className="summary-metric-card card-dimensions">
        <div className="metric-icon-box purple">
          <Tag size={20} />
        </div>
        <div className="metric-info-col">
          <span className="metric-title-label">Dimensions</span>
          <strong className="metric-big-value">
            {formatNumber(dimensionsCount)}
          </strong>
          <span className="metric-explanation">Categorical columns</span>
        </div>
      </div>

      {/* 5. Missing Values */}
      <div className="summary-metric-card card-missing">
        <div className="metric-icon-box red">
          <AlertTriangle size={20} />
        </div>
        <div className="metric-info-col">
          <span className="metric-title-label">Missing Values</span>
          <strong className="metric-big-value">
            {formatNumber(missingCount)}
          </strong>
          <span className="metric-explanation">
            {missingCount === 0 ? 'No missing data' : `${missingCount} values missing`}
          </span>
        </div>
      </div>

      {/* 6. Uploaded Dataset Status Card */}
      <div className="summary-metric-card card-dataset-status">
        <div className="metric-icon-box file-blue">
          <FileSpreadsheet size={20} />
        </div>
        <div className="metric-info-col dataset-col">
          <strong className="dataset-file-title" title={hasDataset ? fileName : 'No file loaded'}>
            {hasDataset ? fileName : 'No dataset loaded'}
          </strong>
          <span className="dataset-stats-line">
            {hasDataset
              ? `${profile?.rows || 0} rows • ${profile?.columns || 0} columns • ${formatFileSize(fileSizeBytes)}`
              : 'Waiting for CSV upload'}
          </span>
          <div className="dataset-success-badge">
            <CheckCircle2 size={13} className="success-check-icon" />
            <span>{hasDataset ? 'Processed successfully' : 'Ready for ingestion'}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
