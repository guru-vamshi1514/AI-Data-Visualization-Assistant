import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import './App.css'

import Header from './components/Header'
import Sidebar from './components/Sidebar'
import WelcomeBanner from './components/WelcomeBanner'
import UploadCard from './components/UploadCard'
import MetricCards from './components/MetricCards'
import DimensionSlicer from './components/DimensionSlicer'
import AIAssistant from './components/AIAssistant'
import ChartArea from './components/ChartArea'
import ChartBuilder from './components/ChartBuilder'
import Recommendations from './components/Recommendations'
import DataQualityPanel from './components/DataQualityPanel'
import InsightsPanel from './components/InsightsPanel'
import DataExplorer from './components/DataExplorer'
import ReportModal from './components/ReportModal'
import SettingsModal from './components/SettingsModal'
import InfoModal from './components/InfoModal'
import WhatIfModal from './components/WhatIfModal'
import AnomalyWatchdogModal from './components/AnomalyWatchdogModal'
import CalculatedColumnModal from './components/CalculatedColumnModal'
import Footer from './components/Footer'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function parseCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header) => header.trim(),
  })

  return parsed.data.filter((row) =>
    Object.values(row).some((value) => value !== null && value !== undefined && value !== ''),
  )
}

function isNumeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function standardDeviation(values) {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function correlation(rows, xKey, yKey) {
  const pairs = rows
    .map((row) => [Number(row[xKey]), Number(row[yKey])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (pairs.length < 2) return 0

  const xMean = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length
  const yMean = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0)
  const xDen = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0))
  const yDen = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0))
  return xDen && yDen ? numerator / (xDen * yDen) : 0
}

function buildCorrelations(rows, numericColumns) {
  if (numericColumns.length < 2) return []

  return numericColumns.map((metric) => {
    const item = { metric }
    numericColumns.forEach((other) => {
      item[other] = Number(correlation(rows, metric, other).toFixed(3))
    })
    return item
  })
}

function detectOutliers(rows, numericColumns) {
  return numericColumns
    .map((column) => {
      const values = rows.map((row) => Number(row[column])).filter(Number.isFinite).sort((a, b) => a - b)
      if (values.length < 4) return null
      const q1 = values[Math.floor(values.length * 0.25)]
      const q3 = values[Math.floor(values.length * 0.75)]
      const iqr = q3 - q1
      if (!iqr) return null
      const lower = q1 - 1.5 * iqr
      const upper = q3 + 1.5 * iqr
      const count = values.filter((value) => value < lower || value > upper).length
      return count ? { column, count, lower, upper } : null
    })
    .filter(Boolean)
}

function profileRows(rows) {
  if (!rows.length) {
    return {
      rows: 0,
      columns: 0,
      columnNames: [],
      types: { all: [], numeric: [], categorical: [], date: [] },
      missingByColumn: {},
      uniqueByColumn: {},
      numericSummary: {},
      preview: [],
      correlations: [],
      outliers: [],
      segmentLeaders: [],
    }
  }

  const columnNames = Object.keys(rows[0])
  const numeric = []
  const categorical = []
  const date = []
  const missingByColumn = {}
  const uniqueByColumn = {}
  const numericSummary = {}
  const segmentLeaders = []

  columnNames.forEach((column) => {
    const values = rows.map((row) => row[column])
    const present = values.filter((value) => value !== null && value !== undefined && value !== '')
    const numericCount = present.filter(isNumeric).length
    const dateCount = present.filter((value) => Number.isNaN(Number(value)) && !Number.isNaN(Date.parse(value))).length
    missingByColumn[column] = values.length - present.length
    uniqueByColumn[column] = new Set(present.map(String)).size

    if (present.length && numericCount / present.length > 0.7) {
      numeric.push(column)
      const nums = present.map(Number).filter(Number.isFinite)
      const sum = nums.reduce((total, value) => total + value, 0)
      const sorted = [...nums].sort((a, b) => a - b)
      numericSummary[column] = {
        count: nums.length,
        sum,
        mean: nums.length ? sum / nums.length : 0,
        median: sorted[Math.floor(sorted.length / 2)] || 0,
        min: Math.min(...nums),
        max: Math.max(...nums),
        std: standardDeviation(nums),
      }
    } else if (present.length && dateCount / present.length > 0.7) {
      date.push(column)
    } else {
      categorical.push(column)
    }
  })

  ;[...categorical, ...date].forEach((dimension) => {
    numeric.forEach((metric) => {
      const grouped = aggregateRows(rows, dimension, metric, 'sum').sort((a, b) => b.value - a.value)
      if (!grouped.length) return
      segmentLeaders.push({
        dimension,
        metric,
        top: grouped[0].name,
        topValue: grouped[0].value,
        bottom: grouped[grouped.length - 1].name,
        bottomValue: grouped[grouped.length - 1].value,
      })
    })
  })

  return {
    rows: rows.length,
    columns: columnNames.length,
    columnNames,
    types: { all: columnNames, numeric, categorical, date },
    missingByColumn,
    uniqueByColumn,
    numericSummary,
    segmentLeaders,
    preview: rows.slice(0, 15),
    correlations: buildCorrelations(rows, numeric),
    outliers: detectOutliers(rows, numeric),
  }
}

function buildCleaningReport(rows, profile) {
  const duplicateRows = rows.length - new Set(rows.map((row) => JSON.stringify(row))).size
  const columnsWithMissing = Object.entries(profile.missingByColumn)
    .filter(([, missing]) => missing > 0)
    .map(([column, missing]) => ({
      column,
      missing,
      percent: Number(((missing / Math.max(rows.length, 1)) * 100).toFixed(2)),
    }))

  const missingTotal = columnsWithMissing.reduce((sum, item) => sum + item.missing, 0)
  const inconsistentCategories = profile.types.categorical.flatMap((column) => {
    const groups = rows.reduce((acc, row) => {
      const raw = String(row[column] ?? '').trim()
      if (!raw) return acc
      const key = raw.toLowerCase()
      acc[key] = acc[key] || new Set()
      acc[key].add(raw)
      return acc
    }, {})

    return Object.values(groups)
      .filter((variants) => variants.size > 1)
      .map((variants) => ({ column, variants: Array.from(variants) }))
  })

  return { missingTotal, duplicateRows, columnsWithMissing, inconsistentCategories }
}

function generateInsights(rows, profile, cleaningReport) {
  const insights = []
  const { numeric, categorical } = profile.types

  if (numeric.length) {
    const topMetric = [...numeric].sort(
      (a, b) => profile.numericSummary[b].sum - profile.numericSummary[a].sum,
    )[0]
    insights.push(`${topMetric} has the largest total at ${formatNumber(profile.numericSummary[topMetric].sum)}.`)
  }

  if (numeric.length && categorical.length) {
    const metric = numeric[0]
    const category = categorical[0]
    const grouped = aggregateRows(rows, category, metric, 'sum').sort((a, b) => b.value - a.value)
    if (grouped.length) {
      insights.push(`${grouped[0].name} leads ${metric} by ${category} with ${formatNumber(grouped[0].value)}.`)
      insights.push(`${grouped[grouped.length - 1].name} is the lowest segment for ${metric}.`)
    }
  }

  if (profile.correlations.length && numeric.length >= 2) {
    insights.push(`${numeric[0]} and ${numeric[1]} have correlation ${correlation(rows, numeric[0], numeric[1]).toFixed(2)}.`)
  }

  if (cleaningReport.missingTotal) {
    insights.push(`${cleaningReport.missingTotal} missing values need review before final reporting.`)
  }

  if (cleaningReport.duplicateRows) {
    insights.push(`${cleaningReport.duplicateRows} duplicate rows were detected.`)
  }

  if (profile.outliers.length) {
    insights.push(`${profile.outliers[0].column} has ${profile.outliers[0].count} possible outlier values.`)
  }

  return insights.length ? insights : ['The dataset is ready for first-pass exploratory analysis.']
}

function recommendCharts(profile) {
  const { numeric, categorical, date } = profile.types
  const recommendations = []

  if (date.length && numeric.length) {
    recommendations.push({
      type: 'line',
      title: `${numeric[0]} trend by ${date[0]}`,
      xKey: date[0],
      yKey: numeric[0],
      aggregation: 'sum',
      reason: 'Best for showing temporal changes and momentum over time.',
    })
  }

  if (categorical.length && numeric.length) {
    recommendations.push({
      type: 'bar',
      title: `${numeric[0]} by ${categorical[0]}`,
      xKey: categorical[0],
      yKey: numeric[0],
      aggregation: 'sum',
      reason: 'Best for discrete category volume and performance comparison.',
    })
    recommendations.push({
      type: 'pie',
      title: `${numeric[0]} share by ${categorical[0]}`,
      xKey: categorical[0],
      yKey: numeric[0],
      aggregation: 'sum',
      reason: 'Useful for evaluating proportional contribution and share.',
    })
  }

  if (numeric.length >= 2) {
    recommendations.push({
      type: 'scatter',
      title: `${numeric[0]} vs ${numeric[1]}`,
      xKey: numeric[0],
      yKey: numeric[1],
      aggregation: 'none',
      reason: 'Reveals statistical correlations, clusters, and bivariate outliers.',
    })
    recommendations.push({
      type: 'heatmap',
      title: 'Correlation matrix heatmap',
      xKey: numeric[0],
      yKey: numeric[1],
      aggregation: 'correlation',
      reason: 'Summarizes linear dependencies across all numerical features.',
    })
  }

  if (numeric.length) {
    recommendations.push({
      type: 'histogram',
      title: `${numeric[0]} distribution`,
      xKey: numeric[0],
      yKey: 'count',
      aggregation: 'count',
      reason: 'Visualizes frequency distribution, skewness, and modality.',
    })
    recommendations.push({
      type: 'box',
      title: `${numeric[0]} outlier check`,
      xKey: numeric[0],
      yKey: numeric[0],
      aggregation: 'distribution',
      reason: 'A box plot highlights spread, median, and outliers.',
    })
  }

  return recommendations
}

function aggregateRows(rows, xKey, yKey, aggregation = 'sum') {
  if (!xKey || !yKey) return []

  const grouped = rows.reduce((acc, row) => {
    const key = row[xKey] || 'Unknown'
    const value = Number(row[yKey])
    if (!acc.has(key)) {
      acc.set(key, { name: key, values: [] })
    }
    if (Number.isFinite(value)) {
      acc.get(key).values.push(value)
    }
    return acc
  }, new Map())

  return Array.from(grouped.values()).map((item) => {
    let value = item.values.reduce((sum, number) => sum + number, 0)
    if (aggregation === 'avg') value = item.values.length ? value / item.values.length : 0
    if (aggregation === 'count') value = item.values.length
    if (aggregation === 'min') value = Math.min(...item.values)
    if (aggregation === 'max') value = Math.max(...item.values)
    return { name: item.name, value: Number.isFinite(value) ? value : 0 }
  })
}

function buildBoxPlotStats(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite).sort((a, b) => a - b)
  if (!values.length) return null
  const q1 = values[Math.floor(values.length * 0.25)]
  const median = values[Math.floor(values.length * 0.5)]
  const q3 = values[Math.floor(values.length * 0.75)]
  const iqr = q3 - q1
  const whiskerLow = Math.max(values[0], q1 - 1.5 * iqr)
  const whiskerHigh = Math.min(values[values.length - 1], q3 + 1.5 * iqr)
  const outliers = values.filter((v) => v < whiskerLow || v > whiskerHigh)
  return { min: values[0], max: values[values.length - 1], q1, median, q3, whiskerLow, whiskerHigh, outliers, count: values.length }
}

function buildHistogram(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite).sort((a, b) => a - b)
  if (!values.length) return []
  const bins = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(values.length))))
  const min = values[0]
  const max = values[values.length - 1]
  const width = (max - min || 1) / bins
  const output = Array.from({ length: bins }, (_, index) => ({
    name: `${formatNumber(min + index * width)}-${formatNumber(min + (index + 1) * width)}`,
    value: 0,
  }))
  values.forEach((value) => {
    const index = Math.min(Math.floor((value - min) / width), bins - 1)
    output[index].value += 1
  })
  return output
}

function buildHeatmapData(profile) {
  const numeric = profile.types.numeric
  return numeric.flatMap((rowMetric) =>
    numeric.map((columnMetric) => {
      const row = profile.correlations.find((item) => item.metric === rowMetric)
      return { x: columnMetric, y: rowMetric, value: row?.[columnMetric] ?? 0 }
    }),
  )
}

function buildChartData(rows, chart, profile) {
  if (!chart) return []
  if (chart.type === 'scatter') {
    return rows
      .map((row) => ({ [chart.xKey]: Number(row[chart.xKey]), [chart.yKey]: Number(row[chart.yKey]) }))
      .filter((row) => Number.isFinite(row[chart.xKey]) && Number.isFinite(row[chart.yKey]))
  }
  if (chart.type === 'histogram') {
    return buildHistogram(rows, chart.xKey)
  }
  if (chart.type === 'heatmap') {
    return buildHeatmapData(profile)
  }
  if (chart.type === 'box') {
    const stats = buildBoxPlotStats(rows, chart.xKey)
    return stats ? [stats] : []
  }
  return aggregateRows(rows, chart.xKey, chart.yKey, chart.aggregation)
}

function createLocalDataset(rows, fileName) {
  const profile = profileRows(rows)
  const cleaningReport = buildCleaningReport(rows, profile)
  return {
    datasetId: 'local-dataset',
    fileName,
    profile,
    cleaningReport,
    insights: generateInsights(rows, profile, cleaningReport),
    recommendations: recommendCharts(profile),
  }
}

function createEmptyDataset() {
  return {
    datasetId: null,
    fileName: 'No dataset uploaded',
    profile: profileRows([]),
    cleaningReport: {
      missingTotal: 0,
      duplicateRows: 0,
      columnsWithMissing: [],
      inconsistentCategories: [],
    },
    insights: [],
    recommendations: [],
  }
}

function localAsk(question, dataset, rows) {
  const q = question.toLowerCase().trim()
  const { numeric, categorical, date: dates } = dataset.profile.types
  const dimensions = [...categorical, ...dates]
  const numSummary = dataset.profile.numericSummary || {}
  const totalRows = dataset.profile.rows || rows.length
  const totalCols = dataset.profile.columns || dataset.profile.columnNames.length
  const cleaningReport = dataset.cleaningReport || {}

  const analyticalNumeric = numeric.filter((c) => !/id|index|key|code|phone|zip|serial|number|num/i.test(c))
  const effectiveNumeric = analyticalNumeric.length ? analyticalNumeric : numeric

  // Find metric
  let selectedMetric = null
  for (const col of numeric) {
    if (q.includes(col.toLowerCase())) {
      selectedMetric = col
      break
    }
  }
  if (!selectedMetric) {
    for (const col of effectiveNumeric) {
      const cl = col.toLowerCase()
      if (q.includes('sale') && cl.includes('sale')) {
        selectedMetric = col
        break
      }
      if (q.includes('profit') && cl.includes('profit')) {
        selectedMetric = col
        break
      }
      if ((q.includes('quantity') || q.includes('qty') || q.includes('units') || q.includes('volume')) && (cl.includes('quant') || cl.includes('qty'))) {
        selectedMetric = col
        break
      }
    }
  }
  if (!selectedMetric && effectiveNumeric.length) {
    selectedMetric = effectiveNumeric.find((c) => /profit/i.test(c)) ||
      effectiveNumeric.find((c) => /rev|sale/i.test(c)) ||
      effectiveNumeric[0]
  }

  // Find dimension
  let selectedDimension = null
  for (const col of dimensions) {
    if (q.includes(col.toLowerCase())) {
      selectedDimension = col
      break
    }
  }
  if (!selectedDimension) {
    for (const col of dimensions) {
      const cl = col.toLowerCase()
      if (q.includes('cat') && cl.includes('cat')) {
        selectedDimension = col
        break
      }
      if ((q.includes('date') || q.includes('time') || q.includes('day') || q.includes('month') || q.includes('year')) && dates.includes(col)) {
        selectedDimension = col
        break
      }
    }
  }
  if (!selectedDimension && dimensions.length) selectedDimension = dimensions[0]

  const isCurrency = selectedMetric && /sale|profit|price|revenue/i.test(selectedMetric)
  const formatVal = (v) =>
    isCurrency
      ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : Number(v).toLocaleString('en-US')

  // Helper functions
  const getColSum = (col) => {
    if (numSummary[col]?.sum !== undefined) return numSummary[col].sum
    return rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0)
  }

  const getColMean = (col) => {
    if (numSummary[col]?.mean !== undefined) return numSummary[col].mean
    const sum = getColSum(col)
    return totalRows ? sum / totalRows : 0
  }

  const getLeader = (dim, met) => {
    const fromProfile = dataset.profile.segmentLeaders?.find(
      (item) => item.dimension === dim && item.metric === met,
    )
    if (fromProfile) return fromProfile
    if (dim && met && rows.length) {
      const agg = aggregateRows(rows, dim, met, 'sum').sort((a, b) => b.value - a.value)
      if (agg.length) {
        return {
          dimension: dim,
          metric: met,
          top: agg[0].name,
          topValue: agg[0].value,
          bottom: agg[agg.length - 1].name,
          bottomValue: agg[agg.length - 1].value,
        }
      }
    }
    return null
  }

  let answer = ''
  let chart = null

  // Check for matched category value (e.g. "Europe", "Online", "Clothes")
  let matchedCol = null
  let matchedVal = null
  if (rows && rows.length) {
    for (const c of categorical) {
      const uniqueVals = [...new Set(rows.map((r) => r[c]).filter(Boolean))]
      for (const v of uniqueVals) {
        const sv = String(v).trim()
        if (sv.length >= 2) {
          const regex = new RegExp(`\\b${sv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
          if (regex.test(q)) {
            matchedCol = c
            matchedVal = sv
            break
          }
        }
      }
      if (matchedVal) break
    }
  }

  // Detect domain
  const allColsStr = dataset.profile.columnNames.join(' ').toLowerCase()
  const isSalesDomain = /sale|revenue|profit|order|cost|unit|item|channel/i.test(allColsStr)
  const isHealthDomain = /patient|doctor|health|disease|blood|medical|hospital/i.test(allColsStr)
  const isAcademicDomain = /student|grade|score|exam|course|school/i.test(allColsStr)
  const isHrDomain = /employee|salary|department|attrition|hire/i.test(allColsStr)

  const revCol = numeric.find((c) => /rev|sale/i.test(c))
  const profitCol = numeric.find((c) => /profit/i.test(c))
  const costCol = numeric.find((c) => /cost/i.test(c))
  const unitsCol = numeric.find((c) => /unit|quant|qty/i.test(c))
  const itemCol = categorical.find((c) => /item|prod|cat/i.test(c))
  const regionCol = categorical.find((c) => /region|geography|territory/i.test(c))
  const countryCol = categorical.find((c) => /country|nation/i.test(c))
  const channelCol = categorical.find((c) => /channel/i.test(c))

  // 0. DATASET INFO / OVERVIEW / SUMMARY / WHAT IS THIS CSV ABOUT
  if (/info|information|about this|about the|tell me about|describe|what is this|explain this|dataset details|file details|data details|give info|csv info|what does this|what kind of data|what data|what does the csv|what is in this|what is this file|purpose|understand this/i.test(q)) {
    if (isSalesDomain) {
      const revTot = revCol ? getColSum(revCol) : 0
      const profitTot = profitCol ? getColSum(profitCol) : 0
      const costTot = costCol ? getColSum(costCol) : 0
      const unitsTot = unitsCol ? getColSum(unitsCol) : 0
      const margin = revTot > 0 ? (profitTot / revTot) * 100 : 0
      const avgOrder = totalRows > 0 ? revTot / totalRows : 0

      const regCount = regionCol && rows.length ? new Set(rows.map((r) => r[regionCol])).size : categorical.length
      const ctryCount = countryCol && rows.length ? new Set(rows.map((r) => r[countryCol])).size : 0

      let topItemInfo = ''
      if (itemCol && profitCol) {
        const ldr = getLeader(itemCol, profitCol)
        if (ldr) {
          topItemInfo = `\n• Top Product Category: '${ldr.top}' generated the highest profit (${formatVal(ldr.topValue)}).`
        }
      }

      let topRegInfo = ''
      if (regionCol && revCol) {
        const rLdr = getLeader(regionCol, revCol)
        if (rLdr) {
          topRegInfo = `\n• Leading Region: '${rLdr.top}' with ${formatVal(rLdr.topValue)} in gross revenue.`
        }
      }

      let channelInfo = ''
      if (channelCol && rows.length) {
        const chCounts = {}
        rows.forEach((r) => {
          const v = r[channelCol]
          if (v) chCounts[v] = (chCounts[v] || 0) + 1
        })
        const chParts = Object.entries(chCounts).map(([k, v]) => `${k} (${v.toLocaleString()} orders, ${((v / totalRows) * 100).toFixed(1)}%)`)
        channelInfo = `\n• Sales Channels: ${chParts.join(', ')}.`
      }

      const missingTotal = cleaningReport.missingTotal !== undefined ? cleaningReport.missingTotal : Object.values(dataset.profile.missingByColumn || {}).reduce((a, b) => a + b, 0)
      const qualityStr = missingTotal === 0 ? '100% complete (0 missing values across all records)' : `${missingTotal} missing value(s) identified`

      answer = `This dataset represents **Commercial Sales Transactions and Global Order Fulfillment**.\n\n` +
        `**Business Scope & Scope of Operations:**\n` +
        `• Tracks **${totalRows.toLocaleString()} customer purchase orders** across ${regCount} global regions${ctryCount ? ` and ${ctryCount} countries` : ''}.\n` +
        `• Records consumer product categories, fulfillment channels (Online vs. Offline), order priority levels, and shipping timelines.\n\n` +
        `**Key Financial & Operational Metrics:**\n` +
        `• **Total Revenue**: ${formatVal(revTot)}\n` +
        `• **Total Cost**: ${formatVal(costTot)}\n` +
        `• **Total Profit**: ${formatVal(profitTot)} (Overall Gross Margin: **${margin.toFixed(1)}%**)\n` +
        `• **Units Sold**: ${unitsTot.toLocaleString()} units (Average Order Value: ${formatVal(avgOrder)})\n` +
        `${topItemInfo}` +
        `${topRegInfo}` +
        `${channelInfo}\n\n` +
        `**Data Integrity**: ${qualityStr}.\n\n` +
        `**Ask me any question about this data**, for example:\n` +
        `1. "Which country has the highest profit?"\n` +
        `2. "Compare online vs offline sales"\n` +
        `3. "What is the correlation between units sold and revenue?"\n` +
        `4. "What are the top 5 item types by profit?"\n` +
        `5. "How can we increase profitability?"`

      if (itemCol && profitCol) {
        chart = {
          type: 'bar',
          title: `${profitCol} by ${itemCol}`,
          xKey: itemCol,
          yKey: profitCol,
          aggregation: 'sum',
          reason: `Overview of ${profitCol} by ${itemCol}.`,
        }
      } else if (regionCol && revCol) {
        chart = {
          type: 'bar',
          title: `${revCol} by ${regionCol}`,
          xKey: regionCol,
          yKey: revCol,
          aggregation: 'sum',
          reason: `Overview of ${revCol} by ${regionCol}.`,
        }
      } else if (dates.length && revCol) {
        chart = {
          type: 'line',
          title: `${revCol} Timeline`,
          xKey: dates[0],
          yKey: revCol,
          aggregation: 'sum',
          reason: `${revCol} timeline progression.`,
        }
      }
    } else {
      const colList = dataset.profile.columnNames.join(', ')
      const numStr = numeric.length ? numeric.join(', ') : 'None'
      const catStr = categorical.length ? categorical.join(', ') : 'None'
      const dateStr = dates.length ? dates.join(', ') : 'None'

      let leadInfo = ''
      const leader = selectedDimension && selectedMetric ? getLeader(selectedDimension, selectedMetric) : null
      if (leader) {
        leadInfo = `\n• Top Segment: '${leader.top}' leads ${selectedDimension} with ${formatVal(leader.topValue)}.`
      }

      let totInfo = ''
      if (selectedMetric) {
        const tot = getColSum(selectedMetric)
        totInfo = `\n• Total ${selectedMetric}: ${formatVal(tot)}.`
      }

      const missingTotal = cleaningReport.missingTotal !== undefined ? cleaningReport.missingTotal : Object.values(dataset.profile.missingByColumn || {}).reduce((a, b) => a + b, 0)
      const qualityStr = missingTotal === 0 ? '100% complete (0 missing values)' : `${missingTotal} missing value(s)`
      const domainDesc = isHealthDomain ? 'Clinical & Healthcare records' : isAcademicDomain ? 'Educational & Student performance' : isHrDomain ? 'Human Resources & Workforce data' : 'Structured Multi-Dimensional Analytics'

      answer = `This dataset contains **${domainDesc}** with **${totalRows.toLocaleString()} records** across ${totalCols} columns.\n\n` +
        `• Dimensions & Categories: ${catStr}\n` +
        `• Quantitative Metrics: ${numStr}\n` +
        `• Timeline: ${dateStr}\n` +
        `• Data Quality: ${qualityStr}${totInfo}${leadInfo}\n\n` +
        `Ask me any question to explore trends, rankings, comparisons, or correlations!`

      if (dates.length && selectedMetric) {
        chart = {
          type: 'line',
          title: `${selectedMetric} Trend by ${dates[0]}`,
          xKey: dates[0],
          yKey: selectedMetric,
          aggregation: 'sum',
          reason: `Timeline showing ${selectedMetric} progression.`,
        }
      } else if (selectedDimension && selectedMetric) {
        chart = {
          type: 'bar',
          title: `${selectedMetric} by ${selectedDimension}`,
          xKey: selectedDimension,
          yKey: selectedMetric,
          aggregation: 'sum',
          reason: `Overview comparison of ${selectedMetric} by ${selectedDimension}.`,
        }
      }
    }
  }
  // 0.1 PROFIT MARGIN / MARGIN ANALYSIS
  else if (/profit margin|margin|profitability|markup/i.test(q)) {
    if (profitCol && revCol) {
      const totP = getColSum(profitCol)
      const totR = getColSum(revCol)
      const totC = costCol ? getColSum(costCol) : totR - totP
      const overallMargin = totR > 0 ? (totP / totR) * 100 : 0

      const dimTarget = itemCol || selectedDimension || categorical[0]
      let breakdownLines = []
      let topMName = ''
      let topMVal = 0
      let botMName = ''
      let botMVal = 0

      if (dimTarget && rows.length) {
        const grp = {}
        rows.forEach((r) => {
          const k = r[dimTarget]
          if (k) {
            if (!grp[k]) grp[k] = { p: 0, r: 0 }
            grp[k].p += Number(r[profitCol]) || 0
            grp[k].r += Number(r[revCol]) || 0
          }
        })
        const items = Object.entries(grp).map(([k, v]) => ({
          name: k,
          margin: v.r > 0 ? (v.p / v.r) * 100 : 0,
          p: v.p,
          r: v.r,
        })).sort((a, b) => b.margin - a.margin)

        if (items.length) {
          breakdownLines = items.slice(0, 5).map((it) => `• ${it.name}: ${it.margin.toFixed(1)}% margin (${formatVal(it.p)} profit on ${formatVal(it.r)} revenue)`)
          topMName = items[0].name
          topMVal = items[0].margin
          botMName = items[items.length - 1].name
          botMVal = items[items.length - 1].margin
        }
      }

      answer = `**Profit Margin & Profitability Analysis:**\n\n` +
        `• **Overall Gross Profit Margin**: **${overallMargin.toFixed(1)}%**\n` +
        `  - Total Revenue: ${formatVal(totR)}\n` +
        `  - Total Cost: ${formatVal(totC)}\n` +
        `  - Total Profit: ${formatVal(totP)}\n\n` +
        (breakdownLines.length ? `**Profit Margin by ${dimTarget}:**\n${breakdownLines.join('\n')}\n\n• Highest Margin: '${topMName}' at ${topMVal.toFixed(1)}%\n• Lowest Margin: '${botMName}' at ${botMVal.toFixed(1)}%\n` : '')

      chart = {
        type: 'bar',
        title: `Profit Margin Breakdown by ${dimTarget}`,
        xKey: dimTarget,
        yKey: profitCol,
        aggregation: 'sum',
        reason: `Shows profit volume by ${dimTarget} supporting margin analysis.`,
      }
    } else {
      answer = `Profit margin calculation requires both Revenue and Profit metrics. Available metrics: ${numeric.join(', ')}.`
    }
  }
  // 1. SPECIFIC CATEGORY VALUE FILTER (e.g. "total profit in Europe", "Online orders")
  else if (matchedVal && matchedCol && !/compare|vs|versus/i.test(q)) {
    const sub = rows.filter((r) => String(r[matchedCol]).toLowerCase() === matchedVal.toLowerCase())
    const subCount = sub.length
    const subMetSum = selectedMetric ? sub.reduce((acc, r) => acc + (Number(r[selectedMetric]) || 0), 0) : 0
    const subMetMean = subCount ? subMetSum / subCount : 0
    const totAll = selectedMetric ? getColSum(selectedMetric) : 0
    const pct = totAll > 0 ? (subMetSum / totAll) * 100 : 0
    const otherDim = categorical.find((c) => c !== matchedCol)

    answer = `Analysis for '${matchedVal}' (${matchedCol}):\n\n` +
      `• Total Orders: ${subCount.toLocaleString()} (${((subCount / totalRows) * 100).toFixed(1)}% of overall dataset)\n` +
      `• Total ${selectedMetric}: ${formatVal(subMetSum)} (${pct.toFixed(1)}% of total)\n` +
      `• Average ${selectedMetric}: ${formatVal(subMetMean)} per order\n`

    if (otherDim && sub.length && selectedMetric) {
      const agg = aggregateRows(sub, otherDim, selectedMetric, 'sum').sort((a, b) => b.value - a.value)
      if (agg.length) {
        answer += `• Top ${otherDim} within ${matchedVal}: '${agg[0].name}' with ${formatVal(agg[0].value)}.\n`
        chart = {
          type: 'bar',
          title: `${selectedMetric} by ${otherDim} in ${matchedVal}`,
          xKey: otherDim,
          yKey: selectedMetric,
          aggregation: 'sum',
          reason: `${selectedMetric} by ${otherDim} for ${matchedVal}.`,
        }
      }
    }
    if (!chart && selectedMetric) {
      chart = {
        type: 'bar',
        title: `${selectedMetric} for ${matchedVal}`,
        xKey: matchedCol,
        yKey: selectedMetric,
        aggregation: 'sum',
      }
    }
  }
  // 2. COMPARISONS (e.g. "compare online vs offline", "channel difference")
  else if (/compare|vs|versus|difference|differ|contrast/i.test(q)) {
    let targetDim = matchedCol || selectedDimension
    for (const c of categorical) {
      if (q.includes(c.toLowerCase())) {
        targetDim = c
        break
      }
    }
    if (targetDim && selectedMetric && rows.length) {
      const agg = aggregateRows(rows, targetDim, selectedMetric, 'sum').sort((a, b) => b.value - a.value)
      const tot = agg.reduce((acc, it) => acc + it.value, 0)
      const lines = agg.slice(0, 6).map((it) => {
        const pctStr = tot > 0 ? `${((it.value / tot) * 100).toFixed(1)}%` : '0%'
        return `• ${it.name}: ${formatVal(it.value)} (${pctStr} share)`
      })
      const diff = agg[0].value - agg[agg.length - 1].value
      answer = `Comparative breakdown of ${selectedMetric} by ${targetDim}:\n\n` +
        lines.join('\n') + `\n\n` +
        `Key Finding: '${agg[0].name}' leads '${agg[agg.length - 1].name}' by ${formatVal(diff)}.`
      chart = {
        type: 'bar',
        title: `${selectedMetric} Comparison across ${targetDim}`,
        xKey: targetDim,
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: `Comparative breakdown of ${selectedMetric} across ${targetDim}.`,
      }
    }
  }
  // 3. CORRELATIONS & RELATIONSHIPS
  else if (/correlation|relationship|relation|relate|depend|affect|impact/i.test(q)) {
    const foundNums = numeric.filter((c) => q.includes(c.toLowerCase()))
    const num1 = foundNums.length >= 2 ? foundNums[0] : selectedMetric
    const num2 = foundNums.length >= 2 ? foundNums[1] : numeric.find((c) => c !== selectedMetric) || numeric[1]

    if (num1 && num2 && rows.length > 2) {
      let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0, n = 0
      rows.forEach((r) => {
        const x = Number(r[num1]), y = Number(r[num2])
        if (!isNaN(x) && !isNaN(y)) {
          sum1 += x; sum2 += y
          sum1Sq += x * x; sum2Sq += y * y
          pSum += x * y
          n++
        }
      })
      const num = pSum - (sum1 * sum2 / n)
      const den = Math.sqrt((sum1Sq - (sum1 * sum1 / n)) * (sum2Sq - (sum2 * sum2 / n)))
      const rVal = den !== 0 ? num / den : 0
      const strength = Math.abs(rVal) >= 0.7 ? 'Strong' : Math.abs(rVal) >= 0.4 ? 'Moderate' : 'Weak'
      const direction = rVal > 0 ? 'Positive' : 'Negative'

      answer = `Statistical Correlation between ${num1} and ${num2}:\n\n` +
        `• Pearson Correlation Coefficient (r): ${rVal.toFixed(3)} (${strength} ${direction} Correlation)\n` +
        `• Analysis: ` + (rVal > 0.4 ? `As ${num1} increases, ${num2} tends to increase as well.` : rVal < -0.4 ? `As ${num1} increases, ${num2} tends to decrease.` : `There is weak linear dependency between ${num1} and ${num2}.`)

      chart = {
        type: 'scatter',
        title: `${num1} vs ${num2} Relationship`,
        xKey: num1,
        yKey: num2,
        aggregation: 'none',
        reason: `Scatter plot showing relationship between ${num1} and ${num2}.`,
      }
    }
  }
  // 4. TOP N / RANKING
  else if (/top|rank|ranking|leaderboard|best/i.test(q)) {
    const nMatch = q.match(/\b([2-9]|10)\b/)
    const nCount = nMatch ? parseInt(nMatch[1], 10) : 5
    let targetDim = matchedCol || selectedDimension
    for (const c of categorical) {
      if (q.includes(c.toLowerCase())) {
        targetDim = c
        break
      }
    }
    if (targetDim && selectedMetric && rows.length) {
      const agg = aggregateRows(rows, targetDim, selectedMetric, 'sum').sort((a, b) => b.value - a.value).slice(0, nCount)
      const tot = getColSum(selectedMetric)
      const lines = agg.map((it, idx) => `${idx + 1}. ${it.name}: ${formatVal(it.value)}${tot > 0 ? ` (${((it.value / tot) * 100).toFixed(1)}%)` : ''}`)
      answer = `**Top ${agg.length} ${targetDim} by ${selectedMetric}:**\n\n` + lines.join('\n')
      chart = {
        type: 'bar',
        title: `Top ${agg.length} ${targetDim} by ${selectedMetric}`,
        xKey: targetDim,
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: `Top ${targetDim} ranked by ${selectedMetric}.`,
      }
    }
  }
  // 5. STRATEGY & RECOMMENDATIONS
  else if (/recommend|suggestion|advice|how to|improve|increase|grow|strategy/i.test(q)) {
    answer = `**Strategic Business Recommendations for your dataset:**\n\n`
    if (itemCol && profitCol && rows.length) {
      const agg = aggregateRows(rows, itemCol, profitCol, 'sum').sort((a, b) => b.value - a.value)
      if (agg.length) {
        answer += `1. **Prioritize Top Categories**: Focus resources on '${agg[0].name}', which delivers the highest ${profitCol} (${formatVal(agg[0].value)}).\n`
        answer += `2. **Review Lagging Segments**: Evaluate '${agg[agg.length - 1].name}' (${formatVal(agg[agg.length - 1].value)}) to optimize unit margins.\n`
      }
    }
    if (regionCol && (revCol || profitCol) && rows.length) {
      const m = revCol || profitCol
      const rAgg = aggregateRows(rows, regionCol, m, 'sum').sort((a, b) => b.value - a.value)
      if (rAgg.length) {
        answer += `3. **Expand Key Territories**: Accelerate expansion in '${rAgg[0].name}' while auditing marketing in lower-volume zones.\n`
      }
    }
    answer += `4. **Protect Margins**: Monitor high-value transactions and minimize operational bottlenecks.`
    chart = {
      type: 'bar',
      title: `High Impact Drivers for Growth`,
      xKey: itemCol || selectedDimension,
      yKey: profitCol || selectedMetric,
      aggregation: 'sum',
      reason: `Highlights high-impact segments for strategic growth.`,
    }
  }
  // 6. OUTLIERS / ANOMALIES
  else if (/outlier|anomaly|anomalies|extreme value|irregular/i.test(q)) {
    const outliers = dataset.profile.outliers || []
    if (outliers.length) {
      const details = outliers.map(
        (o) => `'${o.column}' has ${o.count} possible outlier(s) (values outside [${o.lower.toFixed(2)}, ${o.upper.toFixed(2)}])`,
      )
      answer = `**Outlier Analysis:**\n\n${details.join('; ')}. A Box Plot is recommended to inspect these extreme points.`
      chart = {
        type: 'box',
        title: `${outliers[0].column} Outlier Check`,
        xKey: outliers[0].column,
        yKey: outliers[0].column,
        aggregation: 'distribution',
        reason: 'Box plot highlights outliers and interquartile spread.',
      }
    } else {
      answer = 'No statistical outliers were detected across numeric columns using the standard 1.5 × IQR threshold. Values are distributed within expected normal bounds.'
      if (selectedMetric) {
        chart = {
          type: 'box',
          title: `${selectedMetric} Distribution & Spread`,
          xKey: selectedMetric,
          yKey: selectedMetric,
          aggregation: 'distribution',
          reason: 'Box plot displays median, quartiles, and whisker bounds.',
        }
      }
    }
  }
  // 7. MISSING VALUES / CLEANING / QUALITY
  else if (/missing|null|empty cell|na |nan|data quality|clean|completeness/i.test(q)) {
    const missingTotal = cleaningReport.missingTotal ?? 0
    const missingCols = cleaningReport.columnsWithMissing || []
    if (missingTotal > 0) {
      const colList = missingCols.map((c) => `${c.column} (${c.missing} missing)`).join(', ')
      answer = `The dataset contains ${missingTotal} missing value(s) in: ${colList}. Data cleaning is recommended before critical reporting.`
    } else {
      answer = `Great news! The dataset is 100% complete with 0 missing values across all ${totalRows.toLocaleString()} rows and ${totalCols} columns.`
    }
    if (selectedDimension && selectedMetric) {
      chart = {
        type: 'bar',
        title: `${selectedMetric} by ${selectedDimension}`,
        xKey: selectedDimension,
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: 'Bar chart comparing complete category aggregates.',
      }
    }
  }
  // 8. AVERAGE / MEAN
  else if (/average|avg|mean/i.test(q)) {
    if (selectedMetric) {
      const avgVal = getColMean(selectedMetric)
      const sumVal = getColSum(selectedMetric)
      const sInfo = numSummary[selectedMetric] || {}
      answer = `The average (mean) ${selectedMetric} is **${formatVal(avgVal)}** per record (Total: ${formatVal(sumVal)}, Min: ${formatVal(sInfo.min || 0)}, Max: ${formatVal(sInfo.max || 0)}).`
      chart = {
        type: 'histogram',
        title: `${selectedMetric} Distribution`,
        xKey: selectedMetric,
        yKey: 'count',
        aggregation: 'count',
        reason: `Shows distribution and frequency around the average ${selectedMetric}.`,
      }
    }
  }
  // 9. HIGHEST / BEST / TOP / MAX
  else if (/highest|best|top|\bmax\b|maximum|most|leader/i.test(q)) {
    const leader = selectedDimension && selectedMetric ? getLeader(selectedDimension, selectedMetric) : null
    if (leader) {
      const tot = getColSum(selectedMetric)
      const pctStr = tot > 0 ? ` (${((leader.topValue / tot) * 100).toFixed(1)}% of total)` : ''
      let topListStr = ''
      if (rows.length) {
        const topGrp = aggregateRows(rows, selectedDimension, selectedMetric, 'sum').sort((a, b) => b.value - a.value).slice(0, 5)
        topListStr = `\n\n**Top 5 ${selectedDimension} by ${selectedMetric}:**\n` + topGrp.map((it, idx) => `${idx + 1}. ${it.name}: ${formatVal(it.value)}${tot > 0 ? ` (${((it.value / tot) * 100).toFixed(1)}%)` : ''}`).join('\n')
      }
      answer = `**Top Performer Analysis:**\n\n` +
        `• **'${leader.top}'** achieved the highest ${selectedMetric} across all ${selectedDimension} segments with a total of **${formatVal(leader.topValue)}**${pctStr}.` +
        topListStr
      chart = {
        type: 'bar',
        title: `${selectedMetric} by ${selectedDimension}`,
        xKey: selectedDimension,
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: `Compares ${selectedMetric} across ${selectedDimension} segments.`,
      }
    } else if (selectedMetric) {
      const maxVal = numSummary[selectedMetric]?.max || 0
      answer = `The highest recorded single value for ${selectedMetric} is **${formatVal(maxVal)}**.`
      chart = {
        type: 'bar',
        title: `${selectedMetric} Max Value`,
        xKey: selectedDimension || selectedMetric,
        yKey: selectedMetric,
        aggregation: 'sum',
      }
    }
  }
  // 10. LOWEST / WORST / BOTTOM / MIN
  else if (/lowest|worst|bottom|least|minimum|\bmin\b|smallest/i.test(q)) {
    const leader = selectedDimension && selectedMetric ? getLeader(selectedDimension, selectedMetric) : null
    if (leader) {
      const tot = getColSum(selectedMetric)
      const pctStr = tot > 0 ? ` (${((leader.bottomValue / tot) * 100).toFixed(1)}% of total)` : ''
      let botListStr = ''
      if (rows.length) {
        const botGrp = aggregateRows(rows, selectedDimension, selectedMetric, 'sum').sort((a, b) => a.value - b.value).slice(0, 5)
        botListStr = `\n\n**Lowest 5 ${selectedDimension} by ${selectedMetric}:**\n` + botGrp.map((it, idx) => `${idx + 1}. ${it.name}: ${formatVal(it.value)}${tot > 0 ? ` (${((it.value / tot) * 100).toFixed(1)}%)` : ''}`).join('\n')
      }
      answer = `**Lowest Performer Analysis:**\n\n` +
        `• **'${leader.bottom}'** recorded the lowest ${selectedMetric} across all ${selectedDimension} segments with **${formatVal(leader.bottomValue)}**${pctStr}.` +
        botListStr + `\n\n` +
        `• Recommendation: Review operational costs, inventory allocation, or pricing strategies for this segment.`
      chart = {
        type: 'bar',
        title: `${selectedMetric} by ${selectedDimension}`,
        xKey: selectedDimension,
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: `Compares ${selectedMetric} across ${selectedDimension} segments.`,
      }
    } else if (selectedMetric) {
      const minVal = numSummary[selectedMetric]?.min || 0
      answer = `The lowest recorded single value for ${selectedMetric} is **${formatVal(minVal)}**.`
      chart = {
        type: 'bar',
        title: `${selectedMetric} Min Value`,
        xKey: selectedDimension || selectedMetric,
        yKey: selectedMetric,
        aggregation: 'sum',
      }
    }
  }
  // 11. TOTAL / SUM
  else if (/total|sum|overall|all sales|combined|aggregate/i.test(q)) {
    if (selectedMetric) {
      const tot = getColSum(selectedMetric)
      const avg = getColMean(selectedMetric)
      answer = `**Total Aggregation for ${selectedMetric}:**\n\n` +
        `• **Overall Total**: **${formatVal(tot)}** across all ${totalRows.toLocaleString()} records\n` +
        `• **Average per Record**: ${formatVal(avg)}`
      if (selectedDimension) {
        chart = {
          type: 'bar',
          title: `Total ${selectedMetric} by ${selectedDimension}`,
          xKey: selectedDimension,
          yKey: selectedMetric,
          aggregation: 'sum',
          reason: `Breakdown of total ${selectedMetric} by ${selectedDimension}.`,
        }
      } else if (dates.length) {
        chart = {
          type: 'line',
          title: `${selectedMetric} Trend`,
          xKey: dates[0],
          yKey: selectedMetric,
          aggregation: 'sum',
          reason: `Timeline showing total ${selectedMetric} progression.`,
        }
      }
    }
  }
  // 12. TREND / TIME / DATE
  else if (/trend|time|date|daily|monthly|over time|timeline|progression/i.test(q)) {
    if (dates.length && selectedMetric) {
      chart = {
        type: 'line',
        title: `${selectedMetric} Trend by ${dates[0]}`,
        xKey: dates[0],
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: `Visualizes ${selectedMetric} trajectory over ${dates[0]}.`,
      }
      answer = `Showing the ${selectedMetric} trend over ${dates[0]}. A line chart highlights momentum, peaks, and dips over time.`
    } else {
      answer = `Temporal trend analysis requires a date column. Available dates: ${dates.length ? dates.join(', ') : 'None'}. Displaying ${selectedMetric} breakdown instead.`
      if (selectedDimension && selectedMetric) {
        chart = {
          type: 'bar',
          title: `${selectedMetric} by ${selectedDimension}`,
          xKey: selectedDimension,
          yKey: selectedMetric,
          aggregation: 'sum',
        }
      }
    }
  }
  // 13. BREAKDOWN / SHARE / DISTRIBUTION
  else if (/by category|breakdown|share|percentage|contribution|distribution/i.test(q)) {
    if (selectedDimension && selectedMetric) {
      chart = {
        type: 'pie',
        title: `${selectedMetric} Share by ${selectedDimension}`,
        xKey: selectedDimension,
        yKey: selectedMetric,
        aggregation: 'sum',
        reason: `Shows share of ${selectedMetric} by ${selectedDimension}.`,
      }
      const tot = getColSum(selectedMetric)
      answer = `Here is the breakdown of ${selectedMetric} by ${selectedDimension} (Total: ${formatVal(tot)}). A pie or bar chart displays the proportional distribution.`
    } else if (selectedMetric) {
      chart = {
        type: 'histogram',
        title: `${selectedMetric} Distribution`,
        xKey: selectedMetric,
        yKey: 'count',
        aggregation: 'count',
        reason: `Distribution of ${selectedMetric} values.`,
      }
      answer = `Displaying the frequency distribution for ${selectedMetric} across all records.`
    }
  }
  // 14. UNIVERSAL DATASET SYNTHESIS (Answers ANY other question with real numbers)
  else {
    const dim = selectedDimension || categorical[0]
    const met = selectedMetric || numeric[0]

    let statSummary = ''
    let marginLine = ''
    if (revCol && profitCol) {
      const rTot = getColSum(revCol)
      const pTot = getColSum(profitCol)
      if (rTot > 0) {
        marginLine = `• Overall Margin: ${((pTot / rTot) * 100).toFixed(1)}% (Total Revenue: ${formatVal(rTot)}, Total Profit: ${formatVal(pTot)})\n`
      }
    }

    if (met) {
      const tot = getColSum(met)
      const avg = getColMean(met)
      statSummary = `• Total ${met}: ${formatVal(tot)} (Average: ${formatVal(avg)} per record)\n`
    }

    let leaderSummary = ''
    if (dim && met) {
      const ldr = getLeader(dim, met)
      if (ldr) {
        leaderSummary = `• Top ${dim}: '${ldr.top}' with ${formatVal(ldr.topValue)}\n• Lowest ${dim}: '${ldr.bottom}' with ${formatVal(ldr.bottomValue)}\n`
      }
    }

    answer = `**Comprehensive Analysis for "${question}":**\n\n` +
      `Based on your dataset profile of ${totalRows.toLocaleString()} records:\n` +
      marginLine +
      statSummary +
      leaderSummary +
      `• Available Dimensions: ${categorical.slice(0, 4).join(', ')}\n` +
      `• Key Quantitative Metrics: ${numeric.slice(0, 4).join(', ')}\n\n` +
      `**Analyst Assessment**: The dataset shows robust commercial performance. We have generated a visual breakdown below to give you direct visibility into performance by ${dim}.`

    if (dim && met) {
      chart = {
        type: 'bar',
        title: `${met} by ${dim}`,
        xKey: dim,
        yKey: met,
        aggregation: 'sum',
        reason: `Breakdown of ${met} by ${dim}.`,
      }
    }
  }

  if (!chart) {
    if (dates.length && numeric.length) {
      chart = {
        type: 'line',
        title: `${numeric[0]} Trend by ${dates[0]}`,
        xKey: dates[0],
        yKey: numeric[0],
        aggregation: 'sum',
      }
    } else if (selectedDimension && selectedMetric) {
      chart = {
        type: 'bar',
        title: `${selectedMetric} by ${selectedDimension}`,
        xKey: selectedDimension,
        yKey: selectedMetric,
        aggregation: 'sum',
      }
    } else if (selectedMetric) {
      chart = {
        type: 'histogram',
        title: `${selectedMetric} Distribution`,
        xKey: selectedMetric,
        yKey: 'count',
        aggregation: 'count',
      }
    }
  }

  return {
    answer,
    chart,
    chartData: buildChartData(rows, chart, dataset.profile),
    insights: dataset.insights,
    source: 'Local Analytics Engine',
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    notation: Math.abs(Number(value)) > 99999 ? 'compact' : 'standard',
  }).format(Number(value) || 0)
}

function getTimeString() {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const chartRef = useRef(null)
  const fileInputRef = useRef(null)

  const [rows, setRows] = useState([])
  const [dataset, setDataset] = useState(() => createEmptyDataset())
  const [fileSizeBytes, setFileSizeBytes] = useState(0)
  const [apiStatus, setApiStatus] = useState('checking')
  const [selectedChartIndex, setSelectedChartIndex] = useState(0)
  const [manualChart, setManualChart] = useState(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [asking, setAsking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', subtitle: '', content: null })

  // High-Impact Analytics Features State
  const [activeFilters, setActiveFilters] = useState({})
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const [watchdogOpen, setWatchdogOpen] = useState(false)
  const [calcModalOpen, setCalcModalOpen] = useState(false)

  const [notifications, setNotifications] = useState(() => [
    {
      id: 'notif-welcome',
      type: 'dataset',
      title: 'Assistant Ready',
      message: 'DataViz AI engine online. Upload a CSV, Excel, or JSON dataset to begin automated analysis.',
      time: getTimeString(),
      read: false,
    },
  ])

  const addNotification = useCallback((type, title, message) => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        title,
        message,
        time: getTimeString(),
        read: false,
      },
      ...prev,
    ])
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  // Sync dark mode data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  // Profile dropdown action handler
  function handleSelectProfileItem(itemKey) {
    if (itemKey === 'profile') {
      setInfoModal({
        isOpen: true,
        title: 'User Profile',
        subtitle: 'Student · Local Session',
        content: (
          <div className="info-modal-profile-card">
            <div className="info-profile-avatar">GV</div>
            <div className="info-profile-fields">
              <div className="info-field-row">
                <span className="info-field-label">Full Name:</span>
                <strong className="info-field-val">Guru Vamshi</strong>
              </div>
              <div className="info-field-row">
                <span className="info-field-label">Role / Tier:</span>
                <span className="info-field-val">Student (Full Access)</span>
              </div>
              <div className="info-field-row">
                <span className="info-field-label">Active Workspace:</span>
                <span className="info-field-val">gen-ai-project-main</span>
              </div>
              <div className="info-field-row">
                <span className="info-field-label">Environment:</span>
                <span className="info-field-val tag-green">Standalone Offline Supported</span>
              </div>
            </div>
          </div>
        ),
      })
    } else if (itemKey === 'settings') {
      setInfoModal({
        isOpen: true,
        title: 'Account Settings',
        subtitle: 'Single-User Local Environment',
        content:
          'This application is running in local single-user mode. There is no external cloud authentication or remote credential sync configured. All preferences and profiling datasets reside solely in your local browser session.',
      })
    } else if (itemKey === 'help') {
      setInfoModal({
        isOpen: true,
        title: 'Help & About DataViz AI',
        subtitle: 'Automated Insights & Decision Support v1.0.0',
        content: (
          <div className="info-help-container">
            <p>
              DataViz AI autonomously inspects tabular CSV, Excel, and JSON datasets, classifies schemas, detects statistical anomalies (IQR), formulates natural-language analytical answers, and recommends optimal visualizations.
            </p>
            <h4 style={{ margin: '12px 0 6px', fontSize: '0.85rem' }}>Helpful Keyboard Shortcuts</h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.6' }}>
              <li><strong>Ctrl + K</strong>: Focus global natural language search bar</li>
              <li><strong>Enter</strong>: Submit query to AI Analyst</li>
              <li><strong>Escape</strong>: Dismiss active modals and dropdown menus</li>
              <li><strong>View All</strong>: Expand all available chart recommendations</li>
            </ul>
          </div>
        ),
      })
    } else if (itemKey === 'logout') {
      setInfoModal({
        isOpen: true,
        title: 'Log Out',
        subtitle: 'Authentication Status',
        content:
          'Log out functionality is not configured for this local application. This instance operates in single-user standalone mode without remote session tokens.',
      })
    }
  }

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Welcome to DataViz AI! Upload a dataset (.csv, .xlsx, .xls, .json) to begin. I will profile your schema, recommend optimal charts, detect data quality issues, and answer natural language inquiries.',
      source: 'System Initialization',
      timestamp: getTimeString(),
    },
  ])

  const profile = dataset.profile
  const hasDataset = rows.length > 0 && profile.columnNames.length > 0

  // Filter rows dynamically across all active slicers
  const filteredRows = useMemo(() => {
    if (!rows.length) return rows
    const filterEntries = Object.entries(activeFilters).filter(([, val]) => val && val !== 'all')
    if (!filterEntries.length) return rows
    return rows.filter((row) =>
      filterEntries.every(([col, val]) => String(row[col]) === String(val))
    )
  }, [rows, activeFilters])

  // Profile overlay with active filtered count
  const effectiveProfile = useMemo(() => {
    if (filteredRows.length === rows.length) return profile
    return { ...profile, rows: filteredRows.length }
  }, [profile, filteredRows.length, rows.length])

  const activeRecommendation = dataset.recommendations[selectedChartIndex] || dataset.recommendations[0]
  const activeChart = manualChart || activeRecommendation
  const chartData = useMemo(() => buildChartData(filteredRows, activeChart, profile), [activeChart, profile, filteredRows])

  // Health check on mount with auto-reconnect polling
  useEffect(() => {
    let isMounted = true
    const checkHealth = () => {
      fetch(`${API_BASE_URL}/health`)
        .then(async (response) => {
          if (!response.ok) throw new Error('offline')
          const data = await response.json()
          if (!isMounted) return
          if (data.has_openai) {
            setApiStatus('ai-online')
          } else {
            setApiStatus('online')
          }
        })
        .catch(() => {
          if (isMounted) setApiStatus('offline')
        })
    }

    checkHealth()
    const timer = setInterval(checkHealth, 5000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  // Ingest and process dataset (CSV, XLSX, XLS, JSON)
  const processFile = useCallback(
    async (file) => {
      const lowerName = (file?.name || '').toLowerCase()
      const valid =
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.json')

      if (!file || !valid) {
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: 'Please upload a valid dataset file. Supported formats: CSV (.csv), Excel (.xlsx, .xls), and JSON (.json).',
            source: 'Validation Error',
            timestamp: getTimeString(),
          },
        ])
        return
      }

      setLoading(true)
      setFileSizeBytes(file.size || 0)
      setActiveFilters({})
      try {
        let parsedRows = []

        if (lowerName.endsWith('.csv')) {
          const csvText = await file.text()
          parsedRows = parseCsv(csvText)
        } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
          const buffer = await file.arrayBuffer()
          const workbook = XLSX.read(buffer, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
          // Normalize numeric values
          parsedRows = parsedRows.map((r) => {
            const clean = {}
            Object.entries(r).forEach(([k, v]) => {
              const trimmedK = String(k).trim()
              if (v !== '' && !isNaN(Number(v)) && typeof v !== 'boolean') {
                clean[trimmedK] = Number(v)
              } else {
                clean[trimmedK] = v
              }
            })
            return clean
          })
        } else if (lowerName.endsWith('.json')) {
          const jsonText = await file.text()
          const parsed = JSON.parse(jsonText)
          const rawList = Array.isArray(parsed) ? parsed : (parsed.data || [parsed])
          parsedRows = rawList.map((r) => {
            const clean = {}
            Object.entries(r).forEach(([k, v]) => {
              const trimmedK = String(k).trim()
              clean[trimmedK] = v !== '' && !isNaN(Number(v)) && typeof v !== 'boolean' ? Number(v) : v
            })
            return clean
          })
        }

        if (!parsedRows.length) {
          throw new Error('Unable to analyze dataset. The file appears to be empty or contains no valid rows.')
        }

        setRows(parsedRows)
        setManualChart(null)
        setSelectedChartIndex(0)
        setMessages([
          {
            role: 'assistant',
            content: `Successfully ingested "${file.name}" with ${parsedRows.length} rows and ${
              Object.keys(parsedRows[0] || {}).length
            } columns. Statistical profiling complete. You can now explore charts, run what-if simulations, slice dimensions, or ask questions.`,
            source: 'Dataset Ingested',
            timestamp: getTimeString(),
          },
        ])

        let loadedDataset = null

        if (apiStatus === 'online' || apiStatus === 'ai-online') {
          const formData = new FormData()
          formData.append('file', file)
          try {
            const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData })
            if (!response.ok) throw new Error(await response.text())
            loadedDataset = await response.json()
            setDataset(loadedDataset)
          } catch {
            setApiStatus('offline')
            loadedDataset = createLocalDataset(parsedRows, file.name)
            setDataset(loadedDataset)
          }
        } else {
          loadedDataset = createLocalDataset(parsedRows, file.name)
          setDataset(loadedDataset)
        }

        // Trigger real application event notifications
        addNotification(
          'dataset',
          'Dataset Uploaded',
          `"${file.name}" processed successfully (${parsedRows.length} rows, ${Object.keys(parsedRows[0] || {}).length} columns).`,
        )

        if (loadedDataset?.profile?.outliers?.length) {
          const firstOutlier = loadedDataset.profile.outliers[0]
          addNotification(
            'warning',
            'Data Quality Warning',
            `${firstOutlier.count} possible outlier(s) detected in ${firstOutlier.column}.`,
          )
        }

        if (loadedDataset?.cleaningReport?.missingTotal > 0) {
          addNotification(
            'warning',
            'Data Quality Warning',
            `${loadedDataset.cleaningReport.missingTotal} missing value(s) detected in dataset.`,
          )
        }

        addNotification(
          'analysis',
          'Analysis Completed',
          'Chart recommendations and statistical profiling are ready.',
        )
      } catch (err) {
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: `Unable to analyze the dataset. Please check that the CSV file is valid and try again. (${err.message})`,
            source: 'Ingest Error',
            timestamp: getTimeString(),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [apiStatus],
  )

  function handleFileUpload(file) {
    if (file) processFile(file)
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) processFile(file)
  }

  // Natural Language Assistant Query
  async function handleAskQuestion(queryText) {
    const cleanQuestion = (queryText || question).trim()
    if (!cleanQuestion || !hasDataset) return

    setMessages((current) => [
      ...current,
      { role: 'user', content: cleanQuestion, timestamp: getTimeString() },
    ])
    setQuestion('')
    setAsking(true)

    if ((apiStatus === 'online' || apiStatus === 'ai-online') && dataset.datasetId && dataset.datasetId !== 'local-dataset') {
      try {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset_id: dataset.datasetId, question: cleanQuestion }),
        })
        if (!response.ok) throw new Error(await response.text())
        const answer = await response.json()
        if (answer.chart) setManualChart(normalizeChart(answer.chart))
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: answer.answer,
            source: answer.source ? `FastAPI (${answer.source})` : 'FastAPI Engine',
            insights: answer.insights,
            timestamp: getTimeString(),
          },
        ])
        addNotification(
          'ai',
          'AI Analysis Completed',
          `Answer ready for "${cleanQuestion.length > 28 ? cleanQuestion.slice(0, 28) + '...' : cleanQuestion}".`,
        )
        setAsking(false)
        return
      } catch {
        setApiStatus('offline')
      }
    }

    // Local fallback
    const answer = localAsk(cleanQuestion, dataset, rows)
    if (answer.chart) setManualChart(normalizeChart(answer.chart))
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: answer.answer,
        source: answer.source,
        insights: answer.insights,
        timestamp: getTimeString(),
      },
    ])
    addNotification(
      'ai',
      'AI Analysis Completed',
      `Answer ready for "${cleanQuestion.length > 28 ? cleanQuestion.slice(0, 28) + '...' : cleanQuestion}".`,
    )
    setAsking(false)
  }

  function normalizeChart(chart) {
    return {
      type: chart.type || 'bar',
      title: chart.title || `${chart.yKey || chart.xKey} visualization`,
      xKey: chart.xKey || chart.x_key,
      yKey: chart.yKey || chart.y_key || 'value',
      aggregation: chart.aggregation || 'sum',
      reason: chart.reason || 'Generated from your question.',
    }
  }

  function updateManualChart(field, value) {
    if (!hasDataset) return
    setManualChart((current) => ({
      ...(current || activeChart || {}),
      type: current?.type || activeChart?.type || 'bar',
      title: 'Custom User Configuration',
      xKey: current?.xKey || activeChart?.xKey || profile.columnNames[0],
      yKey: current?.yKey || activeChart?.yKey || profile.types.numeric[0],
      aggregation: current?.aggregation || activeChart?.aggregation || 'sum',
      reason: 'Built interactively via Manual Chart Builder controls.',
      [field]: value,
    }))
  }

  function resetToRecommended() {
    setManualChart(null)
  }

  function selectRecommendation(index) {
    setManualChart(null)
    setSelectedChartIndex(index)
    const rec = dataset.recommendations[index]
    if (rec) {
      addNotification('chart', 'Chart Generated', `Switched visualization to ${rec.title}.`)
    }
  }

  async function exportChart() {
    if (!hasDataset || !chartRef.current) return
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })
      const link = document.createElement('a')
      link.download = `${dataset.fileName.replace(/\.[^/.]+$/, '')}-chart.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      addNotification('chart', 'Chart Exported', `Saved visualization as ${link.download}.`)
    } catch (err) {
      console.error('Error exporting chart PNG:', err)
    }
  }

  function exportChartSVG() {
    if (!chartRef.current) return
    const svgEl = chartRef.current.querySelector('svg')
    if (!svgEl) {
      addNotification('warning', 'SVG Export Notice', 'No scalable SVG vector element found in chart viewport.')
      return
    }
    const serializer = new XMLSerializer()
    let source = serializer.serializeToString(svgEl)
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source)
    const link = document.createElement('a')
    link.download = `${dataset.fileName.replace(/\.[^/.]+$/, '')}-chart.svg`
    link.href = url
    link.click()
    addNotification('chart', 'Chart SVG Exported', `Saved vector visualization as ${link.download}.`)
  }

  function exportChartDataCSV() {
    if (!chartData || !chartData.length) return
    const csv = Papa.unparse(chartData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${dataset.fileName.replace(/\.[^/.]+$/, '')}-chart-data.csv`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    addNotification('chart', 'Chart Data Exported', `Downloaded CSV dataset points for ${link.download}.`)
  }

  function handleAddCalculatedColumn(newCol) {
    if (!newCol || !newCol.name) return
    const colName = newCol.name.trim()

    setRows((currentRows) => {
      const updated = currentRows.map((row) => {
        let val = 0
        if (newCol.preset === 'margin') {
          const rev = Number(row[newCol.colA]) || 0
          const prof = Number(row[newCol.colB]) || 0
          val = rev !== 0 ? Number(((prof / rev) * 100).toFixed(2)) : 0
        } else if (newCol.preset === 'unit_margin') {
          const prof = Number(row[newCol.colA]) || 0
          const qty = Number(row[newCol.colB]) || 0
          val = qty !== 0 ? Number((prof / qty).toFixed(2)) : 0
        } else if (newCol.preset === 'tax') {
          const rev = Number(row[newCol.colA]) || 0
          val = Number((rev * 0.15).toFixed(2))
        } else if (newCol.formulaType === 'cols') {
          const vA = Number(row[newCol.colA]) || 0
          const vB = Number(row[newCol.colB]) || 0
          if (newCol.op === '+') val = vA + vB
          else if (newCol.op === '-') val = vA - vB
          else if (newCol.op === '*') val = vA * vB
          else if (newCol.op === '/') val = vB !== 0 ? Number((vA / vB).toFixed(4)) : 0
        } else if (newCol.formulaType === 'scalar') {
          const vA = Number(row[newCol.colA]) || 0
          const s = Number(newCol.scalar) || 0
          if (newCol.op === '+') val = vA + s
          else if (newCol.op === '-') val = vA - s
          else if (newCol.op === '*') val = vA * s
          else if (newCol.op === '/') val = s !== 0 ? Number((vA / s).toFixed(4)) : 0
        }
        return { ...row, [colName]: val }
      })

      const newLocalDataset = createLocalDataset(updated, dataset.fileName)
      setDataset(newLocalDataset)
      return updated
    })

    addNotification(
      'analysis',
      'Calculated Metric Added',
      `Calculated column "${colName}" successfully created and profiled.`,
    )
  }

  const generatedReportText = useMemo(() => {
    if (!hasDataset) return 'No dataset loaded yet. Upload a CSV file to generate a report.'
    return [
      '===============================================================',
      '  DATAVIZ AI - AUTOMATED INSIGHTS & DECISION SUPPORT REPORT',
      '===============================================================',
      '',
      `Dataset File: ${dataset.fileName}`,
      `Report Generated: ${new Date().toLocaleString()}`,
      `Total Rows: ${profile.rows}`,
      `Total Columns: ${profile.columns}`,
      '',
      '---------------------------------------------------------------',
      '  SCHEMA CLASSIFICATION',
      '---------------------------------------------------------------',
      `  Numeric Features:    ${profile.types.numeric.join(', ') || 'None'}`,
      `  Categorical Fields:  ${profile.types.categorical.join(', ') || 'None'}`,
      `  Date Dimensions:     ${profile.types.date.join(', ') || 'None'}`,
      '',
      '---------------------------------------------------------------',
      '  NUMERIC SUMMARY STATISTICS',
      '---------------------------------------------------------------',
      ...profile.types.numeric.map((col) => {
        const s = profile.numericSummary[col]
        return s
          ? `  • ${col}: count=${s.count}, min=${formatNumber(s.min)}, max=${formatNumber(s.max)}, mean=${formatNumber(s.mean)}, median=${formatNumber(s.median)}, std=${formatNumber(s.std)}`
          : `  • ${col}: No summary statistics available`
      }),
      '',
      '---------------------------------------------------------------',
      '  DATA QUALITY & ANOMALIES',
      '---------------------------------------------------------------',
      `  Missing Values Total:       ${dataset.cleaningReport.missingTotal}`,
      `  Duplicate Rows:             ${dataset.cleaningReport.duplicateRows}`,
      `  Outlier Columns Detected:   ${profile.outliers.length}`,
      `  Category Inconsistencies:   ${dataset.cleaningReport.inconsistentCategories.length}`,
      ...(dataset.cleaningReport.columnsWithMissing.length
        ? dataset.cleaningReport.columnsWithMissing.map(
            (c) => `    - Missing in ${c.column}: ${c.missing} (${c.percent}%)`,
          )
        : ['    - All columns are 100% complete.']),
      '',
      '---------------------------------------------------------------',
      '  AUTOMATED STATISTICAL INSIGHTS',
      '---------------------------------------------------------------',
      ...dataset.insights.map((insight) => `  • ${insight}`),
      '',
      '---------------------------------------------------------------',
      '  RECOMMENDED VISUALIZATIONS',
      '---------------------------------------------------------------',
      ...dataset.recommendations.map(
        (chart) => `  • [${chart.type.toUpperCase()}] ${chart.title}: ${chart.reason}`,
      ),
      '',
      '---------------------------------------------------------------',
      '  ASSISTANT CONVERSATION LOG',
      '---------------------------------------------------------------',
      ...messages.map((m) => `  [${m.role.toUpperCase()} - ${m.timestamp || ''}] ${m.content}`),
      '',
      '===============================================================',
      '  End of Report · DataViz AI Analytics Assistant',
      '===============================================================',
    ].join('\n')
  }, [hasDataset, dataset, profile, messages])

  function exportReport() {
    if (!hasDataset) return
    const blob = new Blob([generatedReportText], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `${dataset.fileName.replace(/\.csv$/i, '')}-analysis-report.txt`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
    addNotification('report', 'Report Exported', `Downloaded full analysis report for ${dataset.fileName}.`)
  }

  function handleNavSelect(navId) {
    setActiveNav(navId)
    if (navId === 'reports') {
      setReportModalOpen(true)
    } else if (navId === 'explorer') {
      setTimeout(() => {
        document.getElementById('data-explorer')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } else if (navId === 'settings') {
      setSettingsModalOpen(true)
    }
  }

  function triggerBrowseFile() {
    fileInputRef.current?.click()
  }

  return (
    <main className="app-shell">
      {/* Hidden file input for triggers */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
          e.target.value = ''
        }}
      />

      {/* TOP HEADER */}
      <Header
        apiStatus={apiStatus}
        onSearchSubmit={handleAskQuestion}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        notifications={notifications}
        onMarkAllNotificationsRead={markAllNotificationsRead}
        onSelectProfileItem={handleSelectProfileItem}
        hasDataset={hasDataset}
        onOpenWhatIf={() => setWhatIfOpen(true)}
        onOpenWatchdog={() => setWatchdogOpen(true)}
        onOpenAddMetric={() => setCalcModalOpen(true)}
      />

      {/* BODY WITH LEFT SIDEBAR + MAIN CONTENT */}
      <div className="dashboard-layout-body">
        {/* Left Sidebar */}
        <Sidebar
          activeNav={activeNav}
          setActiveNav={handleNavSelect}
          onTriggerUpload={triggerBrowseFile}
          onOpenReports={() => setReportModalOpen(true)}
          onOpenExplorer={() => {
            setActiveNav('explorer')
            setTimeout(() => {
              document.getElementById('data-explorer')?.scrollIntoView({ behavior: 'smooth' })
            }, 50)
          }}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />

        {/* Main Content Area */}
        <div className="dashboard-main-content">
          {/* Row 1: Welcome Banner + Prominent Upload CSV Card */}
          <div className="banner-and-upload-row">
            <WelcomeBanner />
            <UploadCard
              onUploadFile={handleFileUpload}
              loading={loading}
            />
          </div>

          {/* Row 2: 6 Summary Metric Cards */}
          <MetricCards
            profile={effectiveProfile}
            cleaningReport={dataset.cleaningReport}
            hasDataset={hasDataset}
            fileName={dataset.fileName}
            fileSizeBytes={fileSizeBytes}
          />

          {/* Global Dimension Slicers / Interactive Segment Filtering */}
          {hasDataset && (
            <DimensionSlicer
              rows={rows}
              profile={profile}
              activeFilters={activeFilters}
              onFilterChange={(col, val) => setActiveFilters((prev) => ({ ...prev, [col]: val }))}
              onResetFilters={() => setActiveFilters({})}
              filteredCount={filteredRows.length}
              totalCount={rows.length}
            />
          )}

          {/* Row 3: 3-Column Analytics Grid */}
          <div className="main-analytics-grid">
            {/* Left: AI Analyst */}
            <AIAssistant
              messages={messages}
              question={question}
              setQuestion={setQuestion}
              onAsk={handleAskQuestion}
              asking={asking}
              hasDataset={hasDataset}
              profile={profile}
            />

            {/* Center: Main Visualization */}
            <ChartArea
              chartRef={chartRef}
              chart={activeChart}
              data={chartData}
              profile={profile}
              hasDataset={hasDataset}
              loading={loading}
              dragOver={dragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onExportChart={exportChart}
              onExportSVG={exportChartSVG}
              onExportCSV={exportChartDataCSV}
              onExportReport={() => setReportModalOpen(true)}
              onBrowseClick={triggerBrowseFile}
              onChartTypeChange={(newType) => updateManualChart('type', newType)}
            />

            {/* Right: Key Insights + Data Quality */}
            <div className="right-rail-stack">
              <InsightsPanel
                insights={dataset.insights}
                hasDataset={hasDataset}
              />
              <DataQualityPanel
                cleaningReport={dataset.cleaningReport}
                profile={profile}
                hasDataset={hasDataset}
              />
            </div>
          </div>

          {/* Row 4: Chart Recommendations (Left) + Manual Chart Builder (Right) */}
          <div className="recommendations-and-builder-row">
            <Recommendations
              recommendations={dataset.recommendations}
              selectedIndex={selectedChartIndex}
              onSelectRecommendation={selectRecommendation}
              isManualActive={Boolean(manualChart)}
              hasDataset={hasDataset}
            />
            <ChartBuilder
              activeChart={activeChart}
              profile={profile}
              hasDataset={hasDataset}
              onUpdateChart={updateManualChart}
              onResetToRecommended={resetToRecommended}
              isCustom={Boolean(manualChart)}
            />
          </div>

          {/* Row 5: Data Explorer Tabular Preview */}
          <DataExplorer
            rows={filteredRows}
            profile={profile}
            hasDataset={hasDataset}
            fileName={dataset.fileName}
            onExportCsv={exportReport}
          />

          {/* Bottom Footer */}
          <Footer />
        </div>
      </div>

      {/* Full Report Modal View */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportText={generatedReportText}
        fileName={dataset.fileName}
        onDownload={exportReport}
      />

      {/* Application Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        apiStatus={apiStatus}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Info / Profile / Help / Logout Dialog Modal */}
      <InfoModal
        isOpen={infoModal.isOpen}
        onClose={() => setInfoModal((prev) => ({ ...prev, isOpen: false }))}
        title={infoModal.title}
        subtitle={infoModal.subtitle}
        content={infoModal.content}
      />

      {/* Interactive What-If Scenario Simulator */}
      <WhatIfModal
        isOpen={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        rows={filteredRows}
        profile={profile}
        dataset={dataset}
      />

      {/* Automated Risk & Anomaly Watchdog Panel */}
      <AnomalyWatchdogModal
        isOpen={watchdogOpen}
        onClose={() => setWatchdogOpen(false)}
        rows={filteredRows}
        profile={profile}
        dataset={dataset}
      />

      {/* Calculated Column / Metric Creator Modal */}
      <CalculatedColumnModal
        isOpen={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        profile={profile}
        dataset={dataset}
        onAddColumn={handleAddCalculatedColumn}
      />
    </main>
  )
}
