import React, { useState } from 'react'
import { X, Plus, Calculator, Check, Sparkles } from 'lucide-react'

export default function CalculatedColumnModal({ isOpen, onClose, dataset, onAddColumn }) {
  if (!isOpen) return null

  const numeric = dataset?.profile?.types?.numeric || []
  const colNames = dataset?.profile?.columnNames || []

  const [colName, setColName] = useState('')
  const [colA, setColA] = useState(numeric[0] || '')
  const [operator, setOperator] = useState('*')
  const [colB, setColB] = useState(numeric[1] || numeric[0] || '')
  const [scalarValue, setScalarValue] = useState('')
  const [useScalar, setUseScalar] = useState(false)
  const [error, setError] = useState('')

  // Presets
  const presets = [
    {
      title: 'Profit Margin %',
      formula: '(Total Profit / Total Revenue) * 100',
      apply: () => {
        const pCol = numeric.find((c) => /profit/i.test(c))
        const rCol = numeric.find((c) => /rev|sale/i.test(c))
        if (!pCol || !rCol) {
          setError('Requires both Profit and Revenue columns in dataset.')
          return
        }
        onAddColumn({
          name: 'Profit Margin %',
          formula: `(${pCol} / ${rCol}) * 100`,
          compute: (r) => {
            const p = Number(r[pCol]) || 0
            const rev = Number(r[rCol]) || 0
            return rev > 0 ? Number(((p / rev) * 100).toFixed(2)) : 0
          },
        })
        onClose()
      },
    },
    {
      title: 'Unit Margin ($)',
      formula: 'Unit Price - Unit Cost',
      apply: () => {
        const pCol = numeric.find((c) => /price/i.test(c))
        const cCol = numeric.find((c) => /cost/i.test(c))
        if (!pCol || !cCol) {
          setError('Requires Unit Price and Unit Cost columns.')
          return
        }
        onAddColumn({
          name: 'Unit Margin ($)',
          formula: `${pCol} - ${cCol}`,
          compute: (r) => {
            const p = Number(r[pCol]) || 0
            const c = Number(r[cCol]) || 0
            return Number((p - c).toFixed(2))
          },
        })
        onClose()
      },
    },
    {
      title: 'Tax Estimate (10%)',
      formula: 'Revenue * 0.10',
      apply: () => {
        const rCol = numeric.find((c) => /rev|sale/i.test(c)) || numeric[0]
        onAddColumn({
          name: 'Tax Estimate (10%)',
          formula: `${rCol} * 0.10`,
          compute: (r) => {
            const rev = Number(r[rCol]) || 0
            return Number((rev * 0.10).toFixed(2))
          },
        })
        onClose()
      },
    },
  ]

  const handleCreateCustom = (e) => {
    e.preventDefault()
    setError('')
    const cleanName = colName.trim()
    if (!cleanName) {
      setError('Please provide a column name.')
      return
    }
    if (colNames.map((c) => c.toLowerCase()).includes(cleanName.toLowerCase())) {
      setError(`Column '${cleanName}' already exists. Choose a unique name.`)
      return
    }

    if (useScalar) {
      const sNum = Number(scalarValue)
      if (isNaN(sNum)) {
        setError('Please enter a valid numeric value.')
        return
      }
      onAddColumn({
        name: cleanName,
        formula: `${colA} ${operator} ${sNum}`,
        compute: (r) => {
          const a = Number(r[colA]) || 0
          if (operator === '+') return Number((a + sNum).toFixed(2))
          if (operator === '-') return Number((a - sNum).toFixed(2))
          if (operator === '*') return Number((a * sNum).toFixed(2))
          if (operator === '/') return sNum !== 0 ? Number((a / sNum).toFixed(2)) : 0
          return 0
        },
      })
    } else {
      onAddColumn({
        name: cleanName,
        formula: `${colA} ${operator} ${colB}`,
        compute: (r) => {
          const a = Number(r[colA]) || 0
          const b = Number(r[colB]) || 0
          if (operator === '+') return Number((a + b).toFixed(2))
          if (operator === '-') return Number((a - b).toFixed(2))
          if (operator === '*') return Number((a * b).toFixed(2))
          if (operator === '/') return b !== 0 ? Number((a / b).toFixed(2)) : 0
          return 0
        },
      })
    }

    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content calc-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="calc-header-icon-box">
              <Calculator size={20} className="calc-header-icon" />
            </div>
            <div>
              <h3 className="modal-title-text">Create Calculated Metric</h3>
              <p className="modal-subtitle-text">Formulate dynamic mathematical expressions or choose instant presets</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="calc-modern-body">
          {error && <div className="calc-alert-banner">{error}</div>}

          {/* SECTION 1: Quick Presets */}
          <div className="calc-panel-section">
            <div className="calc-section-header">
              <Sparkles size={15} className="calc-sparkle-icon" />
              <span>Instant Recommended Presets</span>
            </div>
            <div className="calc-presets-row">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="calc-preset-tile"
                  onClick={preset.apply}
                  title={`Click to apply ${preset.title}`}
                >
                  <div className="preset-top-row">
                    <span className="preset-badge">One-Click</span>
                    <span className="preset-apply-arrow">→</span>
                  </div>
                  <strong className="preset-title">{preset.title}</strong>
                  <code className="preset-formula-code">{preset.formula}</code>
                </button>
              ))}
            </div>
          </div>

          <div className="calc-or-divider">
            <span className="divider-line" />
            <span className="divider-label">OR BUILD CUSTOM EXPRESSION</span>
            <span className="divider-line" />
          </div>

          {/* SECTION 2: Custom Formula Studio */}
          <form onSubmit={handleCreateCustom} className="calc-builder-card">
            {/* Metric Name Input */}
            <div className="calc-input-block">
              <label className="calc-field-label" htmlFor="calc-col-name">
                New Metric / Column Name <span className="req-star">*</span>
              </label>
              <input
                id="calc-col-name"
                type="text"
                placeholder="e.g. Gross Margin Ratio, Net Revenue After Tax..."
                value={colName}
                onChange={(e) => setColName(e.target.value)}
                className="calc-modern-input"
                autoFocus
                required
              />
            </div>

            {/* Formula Expression Row */}
            <div className="calc-input-block">
              <div className="calc-label-with-toggle">
                <label className="calc-field-label">Formula Definition</label>
                <div className="calc-mode-switch">
                  <button
                    type="button"
                    className={`mode-switch-btn ${!useScalar ? 'active' : ''}`}
                    onClick={() => setUseScalar(false)}
                  >
                    Column to Column
                  </button>
                  <button
                    type="button"
                    className={`mode-switch-btn ${useScalar ? 'active' : ''}`}
                    onClick={() => setUseScalar(true)}
                  >
                    Column & Fixed Number
                  </button>
                </div>
              </div>

              {/* Math Expression Equation Bar */}
              <div className="calc-math-equation-bar">
                {/* Operand A */}
                <div className="equation-operand">
                  <span className="operand-tag">Column A</span>
                  <select
                    value={colA}
                    onChange={(e) => setColA(e.target.value)}
                    className="calc-modern-select"
                  >
                    {numeric.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operator Selector */}
                <div className="equation-operator">
                  <span className="operand-tag">Operator</span>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="calc-modern-select op-select"
                  >
                    <option value="+">+ (Add)</option>
                    <option value="-">− (Subtract)</option>
                    <option value="*">× (Multiply)</option>
                    <option value="/">÷ (Divide)</option>
                  </select>
                </div>

                {/* Operand B */}
                <div className="equation-operand">
                  <span className="operand-tag">{useScalar ? 'Fixed Number' : 'Column B'}</span>
                  {useScalar ? (
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 1.15"
                      value={scalarValue}
                      onChange={(e) => setScalarValue(e.target.value)}
                      className="calc-modern-input number-input"
                      required
                    />
                  ) : (
                    <select
                      value={colB}
                      onChange={(e) => setColB(e.target.value)}
                      className="calc-modern-select"
                    >
                      {numeric.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Real-time Formula Preview */}
              <div className="calc-live-preview">
                <span className="preview-label">Live Expression:</span>
                <code className="preview-code">
                  [{colName.trim() || 'New Metric'}] = [{colA || 'Column A'}] {operator} [{useScalar ? (scalarValue || '0') : (colB || 'Column B')}]
                </code>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="calc-modal-footer">
              <button
                type="button"
                className="calc-btn-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="calc-btn-submit"
              >
                <Plus size={16} />
                <span>Create & Profile Metric</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
