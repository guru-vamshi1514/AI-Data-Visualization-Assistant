import React, { useState, useMemo } from 'react'
import { X, TrendingUp, DollarSign, Percent, RefreshCw, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'

export default function WhatIfModal({ isOpen, onClose, dataset, profile: profileProp, rows = [] }) {
  if (!isOpen) return null

  const profile = profileProp || dataset?.profile || {}
  const numeric = profile?.types?.numeric || []
  const numSummary = profile?.numericSummary || {}

  // Find baseline metrics
  const revCol = numeric.find((c) => /rev|sale|amount/i.test(c)) || numeric[0]
  const profitCol = numeric.find((c) => /profit|gain|margin/i.test(c)) || numeric.find((c) => c !== revCol)
  const costCol = numeric.find((c) => /cost|expense|cogs/i.test(c))

  const baseRev = revCol
    ? (numSummary[revCol]?.sum ?? rows.reduce((acc, r) => acc + (Number(r[revCol]) || 0), 0))
    : 100000

  const baseProfit = profitCol
    ? (numSummary[profitCol]?.sum ?? rows.reduce((acc, r) => acc + (Number(r[profitCol]) || 0), 0))
    : baseRev * 0.25

  const baseCost = costCol
    ? (numSummary[costCol]?.sum ?? rows.reduce((acc, r) => acc + (Number(r[costCol]) || 0), 0))
    : Math.max(0, baseRev - baseProfit)

  const baseMargin = baseRev > 0 ? (baseProfit / baseRev) * 100 : 0

  // Sliders: adjustments in percentage
  const [salesGrowth, setSalesGrowth] = useState(0) // -50% to +50%
  const [costInflation, setCostInflation] = useState(0) // -30% to +30%
  const [volumeGrowth, setVolumeGrowth] = useState(0) // -40% to +40%

  // Recalculate projections
  const projections = useMemo(() => {
    const revMultiplier = (1 + salesGrowth / 100) * (1 + volumeGrowth / 100)
    const costMultiplier = (1 + costInflation / 100) * (1 + volumeGrowth / 100)

    const projRev = baseRev * revMultiplier
    const projCost = baseCost * costMultiplier
    const projProfit = projRev - projCost
    const projMargin = projRev > 0 ? (projProfit / projRev) * 100 : 0

    const deltaRev = projRev - baseRev
    const deltaProfit = projProfit - baseProfit
    const deltaCost = projCost - baseCost
    const deltaMargin = projMargin - baseMargin

    return {
      projRev,
      projCost,
      projProfit,
      projMargin,
      deltaRev,
      deltaProfit,
      deltaCost,
      deltaMargin,
    }
  }, [baseRev, baseCost, baseProfit, baseMargin, salesGrowth, costInflation, volumeGrowth])

  const chartData = [
    {
      metric: 'Revenue',
      Baseline: Math.round(baseRev),
      Projected: Math.round(projections.projRev),
    },
    {
      metric: 'Cost',
      Baseline: Math.round(baseCost),
      Projected: Math.round(projections.projCost),
    },
    {
      metric: 'Profit',
      Baseline: Math.round(baseProfit),
      Projected: Math.round(projections.projProfit),
    },
  ]

  const formatCurrency = (val) => {
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`
    if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}k`
    return `$${val.toLocaleString()}`
  }

  const handleReset = () => {
    setSalesGrowth(0)
    setCostInflation(0)
    setVolumeGrowth(0)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content whatif-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="whatif-badge-icon">⚡</span>
            <div>
              <h3>Interactive "What-If" Scenario Simulator</h3>
              <p>Simulate market conditions, pricing changes, and cost shifts to forecast financial outcomes</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="whatif-body">
          {/* Controls Column */}
          <div className="whatif-controls">
            <div className="whatif-control-header">
              <h4>Simulation Levers</h4>
              <button className="whatif-reset-btn" onClick={handleReset} title="Reset all levers to 0%">
                <RefreshCw size={14} /> Reset
              </button>
            </div>

            {/* Lever 1: Price / Sales Adjustment */}
            <div className="whatif-lever-card">
              <div className="whatif-lever-info">
                <label>Pricing / Value Growth</label>
                <span className={`whatif-lever-val ${salesGrowth > 0 ? 'pos' : salesGrowth < 0 ? 'neg' : ''}`}>
                  {salesGrowth > 0 ? `+${salesGrowth}%` : `${salesGrowth}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="1"
                value={salesGrowth}
                onChange={(e) => setSalesGrowth(Number(e.target.value))}
                className="whatif-slider"
              />
              <div className="whatif-slider-ticks">
                <span>-50%</span>
                <span>0%</span>
                <span>+50%</span>
              </div>
            </div>

            {/* Lever 2: Cost Inflation */}
            <div className="whatif-lever-card">
              <div className="whatif-lever-info">
                <label>Cost / Inflation Shift</label>
                <span className={`whatif-lever-val ${costInflation > 0 ? 'neg' : costInflation < 0 ? 'pos' : ''}`}>
                  {costInflation > 0 ? `+${costInflation}%` : `${costInflation}%`}
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={costInflation}
                onChange={(e) => setCostInflation(Number(e.target.value))}
                className="whatif-slider"
              />
              <div className="whatif-slider-ticks">
                <span>-30%</span>
                <span>0%</span>
                <span>+30%</span>
              </div>
            </div>

            {/* Lever 3: Volume / Demand Growth */}
            <div className="whatif-lever-card">
              <div className="whatif-lever-info">
                <label>Volume / Units Demand</label>
                <span className={`whatif-lever-val ${volumeGrowth > 0 ? 'pos' : volumeGrowth < 0 ? 'neg' : ''}`}>
                  {volumeGrowth > 0 ? `+${volumeGrowth}%` : `${volumeGrowth}%`}
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={volumeGrowth}
                onChange={(e) => setVolumeGrowth(Number(e.target.value))}
                className="whatif-slider"
              />
              <div className="whatif-slider-ticks">
                <span>-40%</span>
                <span>0%</span>
                <span>+40%</span>
              </div>
            </div>
          </div>

          {/* Results Column */}
          <div className="whatif-results">
            {/* 4 Projected Metric Cards */}
            <div className="whatif-metric-grid">
              <div className="whatif-metric-card">
                <span className="whatif-metric-lbl">Projected Revenue</span>
                <div className="whatif-metric-val">{formatCurrency(projections.projRev)}</div>
                <div className={`whatif-metric-delta ${projections.deltaRev >= 0 ? 'pos' : 'neg'}`}>
                  {projections.deltaRev >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{projections.deltaRev >= 0 ? `+${formatCurrency(projections.deltaRev)}` : formatCurrency(projections.deltaRev)}</span>
                </div>
              </div>

              <div className="whatif-metric-card">
                <span className="whatif-metric-lbl">Projected Cost</span>
                <div className="whatif-metric-val">{formatCurrency(projections.projCost)}</div>
                <div className={`whatif-metric-delta ${projections.deltaCost <= 0 ? 'pos' : 'neg'}`}>
                  {projections.deltaCost >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{projections.deltaCost >= 0 ? `+${formatCurrency(projections.deltaCost)}` : formatCurrency(projections.deltaCost)}</span>
                </div>
              </div>

              <div className="whatif-metric-card highlight">
                <span className="whatif-metric-lbl">Projected Profit</span>
                <div className="whatif-metric-val">{formatCurrency(projections.projProfit)}</div>
                <div className={`whatif-metric-delta ${projections.deltaProfit >= 0 ? 'pos' : 'neg'}`}>
                  {projections.deltaProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{projections.deltaProfit >= 0 ? `+${formatCurrency(projections.deltaProfit)}` : formatCurrency(projections.deltaProfit)}</span>
                </div>
              </div>

              <div className="whatif-metric-card">
                <span className="whatif-metric-lbl">Projected Margin</span>
                <div className="whatif-metric-val">{projections.projMargin.toFixed(1)}%</div>
                <div className={`whatif-metric-delta ${projections.deltaMargin >= 0 ? 'pos' : 'neg'}`}>
                  {projections.deltaMargin >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{projections.deltaMargin >= 0 ? `+${projections.deltaMargin.toFixed(1)}%` : `${projections.deltaMargin.toFixed(1)}%`}</span>
                </div>
              </div>
            </div>

            {/* Projection Chart */}
            <div className="whatif-chart-card">
              <div className="whatif-chart-title">
                <BarChart2 size={16} /> Baseline vs. Projected Comparison
              </div>
              <div style={{ width: '100%', height: 210 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 12, right: 16, left: 16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                    <Legend />
                    <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Projected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
