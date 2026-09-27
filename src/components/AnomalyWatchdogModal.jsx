import React, { useMemo } from 'react'
import { X, ShieldAlert, AlertTriangle, CheckCircle, Clock, TrendingDown, FileText } from 'lucide-react'

export default function AnomalyWatchdogModal({ isOpen, onClose, dataset, profile: profileProp, rows = [] }) {
  if (!isOpen) return null

  const profile = profileProp || dataset?.profile || {}
  const numeric = profile?.types?.numeric || []
  const dates = profile?.types?.date || []

  const revCol = numeric.find((c) => /rev|sale|amount/i.test(c)) || numeric[0]
  const profitCol = numeric.find((c) => /profit|gain|margin/i.test(c)) || numeric.find((c) => c !== revCol)
  const costCol = numeric.find((c) => /cost|expense|cogs/i.test(c))
  const orderDateCol = dates.find((c) => /order/i.test(c)) || dates[0]
  const shipDateCol = dates.find((c) => /ship/i.test(c)) || dates[1]

  // Run audits
  const auditResults = useMemo(() => {
    let lossOrders = []
    let totalLossAmount = 0
    let delayedOrders = []
    let negativeValuesFound = []

    if (rows && rows.length) {
      rows.forEach((r, idx) => {
        // 1. Loss detection
        if (profitCol && Number(r[profitCol]) < 0) {
          lossOrders.push({
            id: r['Order ID'] || `#${idx + 1}`,
            loss: Math.abs(Number(r[profitCol])),
            item: r['Item Type'] || r['Product'] || 'Unknown',
            region: r['Region'] || r['Country'] || 'Unknown',
          })
          totalLossAmount += Math.abs(Number(r[profitCol]))
        }

        // 2. Shipping delay audit (> 30 days)
        if (orderDateCol && shipDateCol && r[orderDateCol] && r[shipDateCol]) {
          const dOrder = new Date(r[orderDateCol])
          const dShip = new Date(r[shipDateCol])
          if (!isNaN(dOrder) && !isNaN(dShip)) {
            const diffDays = Math.round((dShip - dOrder) / (1000 * 60 * 60 * 24))
            if (diffDays > 30) {
              delayedOrders.push({
                id: r['Order ID'] || `#${idx + 1}`,
                days: diffDays,
                item: r['Item Type'] || 'Unknown',
              })
            }
          }
        }
      })
    }

    // 3. Outlier checks from profile
    const outliers = profile.outliers || []
    const totalOutliers = outliers.reduce((acc, o) => acc + (o.count || 0), 0)

    // Missing checks
    const missingTotal = dataset?.cleaningReport?.missingTotal ?? Object.values(profile.missingByColumn || {}).reduce((a, b) => a + b, 0)

    // Health Score computation (0 - 100)
    let score = 100
    if (lossOrders.length > 0) score -= Math.min(25, (lossOrders.length / rows.length) * 100 * 2)
    if (totalOutliers > 0) score -= Math.min(15, totalOutliers * 2)
    if (delayedOrders.length > 0) score -= Math.min(15, (delayedOrders.length / rows.length) * 100)
    if (missingTotal > 0) score -= Math.min(20, missingTotal * 2)

    score = Math.max(40, Math.round(score))
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : 'C'

    return {
      lossOrders,
      totalLossAmount,
      delayedOrders,
      outliers,
      totalOutliers,
      missingTotal,
      score,
      grade,
    }
  }, [rows, profile, dataset, profitCol, orderDateCol, shipDateCol])

  const formatCurrency = (val) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content watchdog-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="watchdog-badge-icon">🛡️</span>
            <div>
              <h3>Automated Dataset Anomaly & Risk Watchdog</h3>
              <p>Active auditing engine scanning for loss-making transactions, outliers, and operational delays</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="watchdog-body">
          {/* Health Score Banner */}
          <div className="watchdog-score-banner">
            <div className="watchdog-score-pill">
              <span className="watchdog-score-val">{auditResults.grade}</span>
              <span className="watchdog-score-num">{auditResults.score}/100</span>
            </div>
            <div className="watchdog-score-text">
              <h4>Dataset Integrity Health Score</h4>
              <p>
                {auditResults.score >= 85
                  ? 'Excellent data health! Low risk detected across transactions, formatting, and fulfillment integrity.'
                  : 'Audits identified operational risks or anomalies that should be reviewed before strategic planning.'}
              </p>
            </div>
          </div>

          {/* Audit Cards Grid */}
          <div className="watchdog-cards-grid">
            {/* 1. Loss-Making Orders Audit */}
            <div className={`watchdog-card ${auditResults.lossOrders.length > 0 ? 'warn' : 'ok'}`}>
              <div className="watchdog-card-head">
                <div className="watchdog-card-icon">
                  {auditResults.lossOrders.length > 0 ? <TrendingDown size={18} /> : <CheckCircle size={18} />}
                </div>
                <div>
                  <h5>Profit Loss Check</h5>
                  <span className="watchdog-card-subtitle">
                    {auditResults.lossOrders.length > 0
                      ? `${auditResults.lossOrders.length} loss-making transaction(s) detected`
                      : '0 negative profit transactions detected'}
                  </span>
                </div>
              </div>
              <div className="watchdog-card-content">
                {auditResults.lossOrders.length > 0 ? (
                  <p className="watchdog-loss-alert">
                    Total financial drag of <strong>{formatCurrency(auditResults.totalLossAmount)}</strong> identified in orders requiring pricing reviews.
                  </p>
                ) : (
                  <p className="watchdog-ok-text">
                    All recorded orders generated positive profit margins. No gross losses were detected.
                  </p>
                )}
              </div>
            </div>

            {/* 2. Statistical Outliers Audit */}
            <div className={`watchdog-card ${auditResults.totalOutliers > 0 ? 'warn' : 'ok'}`}>
              <div className="watchdog-card-head">
                <div className="watchdog-card-icon">
                  {auditResults.totalOutliers > 0 ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                </div>
                <div>
                  <h5>Statistical Outliers (1.5 × IQR)</h5>
                  <span className="watchdog-card-subtitle">
                    {auditResults.totalOutliers > 0
                      ? `${auditResults.totalOutliers} extreme point(s) in metrics`
                      : 'Zero extreme outliers detected'}
                  </span>
                </div>
              </div>
              <div className="watchdog-card-content">
                {auditResults.outliers.length > 0 ? (
                  <ul className="watchdog-list">
                    {auditResults.outliers.slice(0, 3).map((o, idx) => (
                      <li key={idx}>
                        '{o.column}': {o.count} point(s) outside [{o.lower.toFixed(1)}, {o.upper.toFixed(1)}]
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="watchdog-ok-text">Values sit cleanly inside expected statistical bounds.</p>
                )}
              </div>
            </div>

            {/* 3. Delivery / Fulfillment Delays */}
            <div className={`watchdog-card ${auditResults.delayedOrders.length > 0 ? 'warn' : 'ok'}`}>
              <div className="watchdog-card-head">
                <div className="watchdog-card-icon">
                  {auditResults.delayedOrders.length > 0 ? <Clock size={18} /> : <CheckCircle size={18} />}
                </div>
                <div>
                  <h5>Fulfillment Velocity Check</h5>
                  <span className="watchdog-card-subtitle">
                    {auditResults.delayedOrders.length > 0
                      ? `${auditResults.delayedOrders.length} order(s) delayed >30 days`
                      : 'All orders fulfilled within 30 days'}
                  </span>
                </div>
              </div>
              <div className="watchdog-card-content">
                {auditResults.delayedOrders.length > 0 ? (
                  <p className="watchdog-warn-text">
                    {auditResults.delayedOrders.length} shipments experienced delivery delays exceeding 30 calendar days.
                  </p>
                ) : (
                  <p className="watchdog-ok-text">
                    Shipping timelines demonstrate consistent fulfillment velocity.
                  </p>
                )}
              </div>
            </div>

            {/* 4. Missing Values / Completeness */}
            <div className={`watchdog-card ${auditResults.missingTotal > 0 ? 'warn' : 'ok'}`}>
              <div className="watchdog-card-head">
                <div className="watchdog-card-icon">
                  {auditResults.missingTotal > 0 ? <FileText size={18} /> : <CheckCircle size={18} />}
                </div>
                <div>
                  <h5>Data Completeness</h5>
                  <span className="watchdog-card-subtitle">
                    {auditResults.missingTotal === 0 ? '100% complete dataset' : `${auditResults.missingTotal} missing cell(s)`}
                  </span>
                </div>
              </div>
              <div className="watchdog-card-content">
                <p className={auditResults.missingTotal === 0 ? 'watchdog-ok-text' : 'watchdog-warn-text'}>
                  {auditResults.missingTotal === 0
                    ? 'Zero null or missing cells identified across all rows and columns.'
                    : 'Some columns contain empty cells. Run data imputation before critical reporting.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
