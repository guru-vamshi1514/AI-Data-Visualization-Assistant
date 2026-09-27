import {
  Download,
  FileText,
  Upload,
  FileUp,
  ChevronDown,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PALETTE = [
  '#2563eb', // Blue
  '#10b981', // Teal / Green
  '#f59e0b', // Amber / Orange
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#3b82f6', // Indigo
  '#14b8a6', // Dark Teal
]

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    notation: Math.abs(Number(value)) > 99999 ? 'compact' : 'standard',
  }).format(Number(value) || 0)
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const dataItem = payload[0]
    return (
      <div className="light-chart-tooltip">
        <p className="tooltip-title">{label || dataItem.name}</p>
        <div className="tooltip-row">
          <span
            className="tooltip-swatch"
            style={{ backgroundColor: dataItem.color || dataItem.payload?.fill || '#2563eb' }}
          />
          <span className="tooltip-key">
            {dataItem.dataKey === 'value' ? 'Total' : dataItem.dataKey}:
          </span>
          <strong className="tooltip-number">
            {formatNumber(dataItem.value)}
          </strong>
        </div>
      </div>
    )
  }
  return null
}

const CHART_TYPES = [
  { id: 'pie', label: 'Pie Chart' },
  { id: 'bar', label: 'Bar Chart' },
  { id: 'line', label: 'Line Chart' },
  { id: 'area', label: 'Area Chart' },
  { id: 'scatter', label: 'Scatter Plot' },
  { id: 'heatmap', label: 'Correlation Heatmap' },
  { id: 'box', label: 'Box Plot' },
]

export default function ChartArea({
  chartRef,
  chart,
  data,
  profile,
  hasDataset,
  loading,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onExportChart,
  onExportSVG,
  onExportCSV,
  onExportReport,
  onBrowseClick,
  onChartTypeChange,
}) {
  const chartType = chart?.type || 'bar'

  return (
    <section className="main-chart-card" id="visualization-section" aria-label="Main Visualization Stage">
      {/* Top Controls Toolbar */}
      <div className="chart-card-header">
        <div className="chart-header-text">
          <h2 className="chart-main-title">
            {chart?.title || (hasDataset ? 'Dataset Visualization' : 'Interactive Visualization')}
          </h2>
          <p className="chart-main-subtitle">
            {chart?.reason ||
              (chartType === 'pie'
                ? 'A pie chart shows the contribution share across categories.'
                : 'Interactive visual representation powered by your dataset.')}
          </p>
        </div>

        <div className="chart-header-actions">
          {/* Chart Type Selector Dropdown */}
          <div className="chart-type-select-wrapper">
            <select
              className="chart-type-selector"
              value={chartType}
              onChange={(e) => onChartTypeChange?.(e.target.value)}
              disabled={!hasDataset}
            >
              {CHART_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>

          {/* Download PNG Button */}
          <button
            type="button"
            className="chart-action-btn download-btn"
            onClick={onExportChart}
            disabled={!hasDataset}
            title="Download PNG visualization"
          >
            <Download size={14} />
            <span>PNG</span>
          </button>

          {/* Export SVG Button */}
          <button
            type="button"
            className="chart-action-btn svg-btn"
            onClick={onExportSVG}
            disabled={!hasDataset}
            title="Export vector SVG graphic"
          >
            <Download size={14} />
            <span>SVG</span>
          </button>

          {/* Export CSV Data Button */}
          <button
            type="button"
            className="chart-action-btn csv-btn"
            onClick={onExportCSV}
            disabled={!hasDataset}
            title="Download aggregated chart dataset as CSV"
          >
            <Download size={14} />
            <span>Data CSV</span>
          </button>

          {/* Generate Report Button */}
          <button
            type="button"
            className="chart-action-btn report-btn"
            onClick={onExportReport}
            disabled={!hasDataset}
            title="Generate full text and statistical analysis report"
          >
            <FileText size={14} />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div
        className={`chart-viewport ${!hasDataset ? 'is-empty-dropzone' : ''} ${
          dragOver ? 'drag-over' : ''
        }`}
        ref={chartRef}
        onDragOver={!hasDataset ? onDragOver : undefined}
        onDragLeave={!hasDataset ? onDragLeave : undefined}
        onDrop={!hasDataset ? onDrop : undefined}
      >
        {loading && (
          <div className="chart-loading-overlay">
            <div className="chart-spinner" />
            <p>Rendering visualization...</p>
          </div>
        )}

        <ChartRenderer
          chart={chart}
          data={data}
          profile={profile}
          hasDataset={hasDataset}
          dragOver={dragOver}
          onBrowseClick={onBrowseClick}
        />
      </div>
    </section>
  )
}

function ChartRenderer({
  chart,
  data,
  profile,
  hasDataset,
  dragOver,
  onBrowseClick,
}) {
  if (!hasDataset) {
    return (
      <div className="chart-empty-uploader" onClick={onBrowseClick} role="button" tabIndex={0}>
        <div className="empty-cloud-box">
          {dragOver ? <Upload size={32} /> : <FileUp size={32} />}
        </div>
        <h3>{dragOver ? 'Drop CSV File Here' : 'Upload CSV Dataset'}</h3>
        <p>
          Drag & drop your file here, or click to browse. Automatic data profiling,
          data quality analysis, insights, and chart recommendations will be generated.
        </p>
        <span className="empty-pill">Supports .csv (Comma-Separated Values)</span>
      </div>
    )
  }

  if (!chart || !data || !data.length) {
    return (
      <div className="chart-no-data-state">
        <p>No chartable data found for this selection.</p>
        <span>Adjust the X Axis or Metric in the Manual Chart Builder below.</span>
      </div>
    )
  }

  if (chart.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={410}>
        <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={135}
            innerRadius={0}
            paddingAngle={1}
            label={({ value, percent }) =>
              `${formatNumber(value)} (${(percent * 100).toFixed(1)}%)`
            }
            labelLine={{ stroke: '#64748b', strokeWidth: 1.5 }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${entry.name || index}`}
                fill={PALETTE[index % PALETTE.length]}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }}
          />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={410}>
        <LineChart data={data} margin={{ top: 25, right: 30, bottom: 25, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            tickFormatter={formatNumber}
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={410}>
        <AreaChart data={data} margin={{ top: 25, right: 30, bottom: 25, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            tickFormatter={formatNumber}
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="lightAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={3}
            fill="url(#lightAreaGradient)"
            dot={{ r: 4, fill: '#2563eb' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={410}>
        <ScatterChart margin={{ top: 25, right: 30, bottom: 25, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey={chart.xKey}
            name={chart.xKey}
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            dataKey={chart.yKey}
            name={chart.yKey}
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={{ stroke: '#cbd5e1' }}
            tickFormatter={formatNumber}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Points" data={data} fill="#2563eb" />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (chart.type === 'heatmap') {
    return <Heatmap data={data} metrics={profile.types.numeric} />
  }

  if (chart.type === 'box' && data.length) {
    return <BoxPlot stats={data[0]} label={chart.xKey} />
  }

  // Default: Bar Chart
  return (
    <ResponsiveContainer width="100%" height={410}>
      <BarChart data={data} margin={{ top: 25, right: 30, bottom: 25, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tickFormatter={formatNumber}
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#cbd5e1' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
          {data.map((entry, index) => (
            <Cell key={`bar-${index}`} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Heatmap({ data, metrics }) {
  if (!metrics || !metrics.length) {
    return <div className="chart-no-data-state">No numeric columns for correlation heatmap.</div>
  }

  return (
    <div
      className="light-heatmap-matrix"
      style={{
        gridTemplateColumns: `140px repeat(${metrics.length}, minmax(80px, 1fr))`,
      }}
    >
      <div className="matrix-corner">Feature Matrix</div>
      {metrics.map((metric) => (
        <strong key={metric} className="matrix-col-header" title={metric}>
          {metric}
        </strong>
      ))}
      {metrics.map((rowMetric) => (
        <div className="matrix-row" key={rowMetric}>
          <strong className="matrix-row-header" title={rowMetric}>
            {rowMetric}
          </strong>
          {metrics.map((columnMetric) => {
            const item = data.find((cell) => cell.x === columnMetric && cell.y === rowMetric)
            const value = item?.value ?? 0
            const absValue = Math.abs(value)
            const bg =
              value >= 0
                ? `rgba(37, 99, 235, ${Math.max(0.12, absValue * 0.85)})`
                : `rgba(239, 68, 68, ${Math.max(0.12, absValue * 0.85)})`
            const textColor = absValue > 0.6 ? '#ffffff' : '#0f172a'
            return (
              <span
                key={columnMetric}
                className="matrix-cell"
                style={{ backgroundColor: bg, color: textColor }}
                title={`${rowMetric} vs ${columnMetric}: ${value.toFixed(3)}`}
              >
                {value.toFixed(2)}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function BoxPlot({ stats, label }) {
  if (!stats) return <div className="chart-no-data-state">No data available for box plot.</div>
  const { min, max, q1, median, q3, whiskerLow, whiskerHigh, outliers, count } = stats
  const range = max - min || 1
  const toPercent = (v) => ((v - min) / range) * 100

  return (
    <div className="light-box-plot">
      <div className="box-plot-meta">
        <h3>{label} Five-Number Summary</h3>
        <span>{count} observations</span>
      </div>
      <div className="box-plot-rail">
        <div
          className="whisker-line"
          style={{
            left: `${toPercent(whiskerLow)}%`,
            width: `${toPercent(q1) - toPercent(whiskerLow)}%`,
          }}
        />
        <div
          className="box-body"
          style={{
            left: `${toPercent(q1)}%`,
            width: `${toPercent(q3) - toPercent(q1)}%`,
          }}
        >
          <div
            className="median-bar"
            style={{ left: `${((median - q1) / (q3 - q1 || 1)) * 100}%` }}
            title={`Median: ${formatNumber(median)}`}
          />
        </div>
        <div
          className="whisker-line"
          style={{
            left: `${toPercent(q3)}%`,
            width: `${toPercent(whiskerHigh) - toPercent(q3)}%`,
          }}
        />
        {outliers.slice(0, 15).map((v, i) => (
          <div
            key={i}
            className="outlier-dot"
            style={{ left: `${toPercent(v)}%` }}
            title={`Outlier: ${formatNumber(v)}`}
          />
        ))}
      </div>
      <div className="box-plot-pill-row">
        <span className="pill">Min: {formatNumber(min)}</span>
        <span className="pill">Q1: {formatNumber(q1)}</span>
        <span className="pill highlight">Median: {formatNumber(median)}</span>
        <span className="pill">Q3: {formatNumber(q3)}</span>
        <span className="pill">Max: {formatNumber(max)}</span>
        {outliers.length > 0 && <span className="pill warn">Outliers: {outliers.length}</span>}
      </div>
    </div>
  )
}
