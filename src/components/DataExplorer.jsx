import { useState, useMemo } from 'react'
import {
  Table2,
  Search,
  Hash,
  Layers,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react'

export default function DataExplorer({
  rows,
  profile,
  hasDataset,
  fileName,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 15

  const columns = profile?.columnNames || []
  const numericSet = useMemo(() => new Set(profile?.types?.numeric || []), [profile])
  const dateSet = useMemo(() => new Set(profile?.types?.date || []), [profile])

  // Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows
    const term = searchTerm.toLowerCase()
    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(term)
      )
    )
  }, [rows, searchTerm])

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    const start = page * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  function getColumnTypeIcon(col) {
    if (numericSet.has(col)) return <Hash size={11} className="col-icon num" />
    if (dateSet.has(col)) return <Calendar size={11} className="col-icon date" />
    return <Layers size={11} className="col-icon cat" />
  }

  function getColumnTypeLabel(col) {
    if (numericSet.has(col)) return 'NUM'
    if (dateSet.has(col)) return 'DATE'
    return 'CAT'
  }

  return (
    <section className="data-explorer-section" id="data-explorer" aria-label="Data Explorer">
      <div className="panel data-explorer-panel">
        <div className="explorer-header-row">
          <div className="panel-title">
            <Table2 size={18} className="panel-title-icon" />
            <div>
              <h2>Data Explorer: {hasDataset ? fileName : 'Dataset Preview'}</h2>
              <span className="panel-subtitle">
                {hasDataset
                  ? `Interactive tabular inspection · Showing ${paginatedRows.length} of ${filteredRows.length} matching rows (${rows.length} total)`
                  : 'Upload a CSV dataset to inspect tabular records'}
              </span>
            </div>
          </div>

          <div className="explorer-toolbar">
            {hasDataset && (
              <div className="table-search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search across all cells..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(0)
                  }}
                  className="table-search-input"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => {
                      setSearchTerm('')
                      setPage(0)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="table-wrap">
          {hasDataset && columns.length > 0 ? (
            <>
              <table className="explorer-table">
                <thead>
                  <tr>
                    <th className="row-num-th">#</th>
                    {columns.map((column) => (
                      <th key={column} className="column-header-th">
                        <div className="col-th-content">
                          <span className="col-name">{column}</span>
                          <span
                            className={`col-type-pill ${getColumnTypeLabel(column).toLowerCase()}`}
                            title={`Inferred type: ${getColumnTypeLabel(column)}`}
                          >
                            {getColumnTypeIcon(column)}
                            <span>{getColumnTypeLabel(column)}</span>
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length > 0 ? (
                    paginatedRows.map((row, rowIndex) => {
                      const absoluteIndex = page * pageSize + rowIndex + 1
                      return (
                        <tr key={`row-${absoluteIndex}`}>
                          <td className="row-num-cell">{absoluteIndex}</td>
                          {columns.map((column) => {
                            const val = row[column]
                            const isNull = val === null || val === undefined || val === ''
                            return (
                              <td
                                key={`${column}-${rowIndex}`}
                                className={`data-cell ${numericSet.has(column) ? 'align-right' : ''} ${
                                  isNull ? 'cell-empty' : ''
                                }`}
                              >
                                {isNull ? (
                                  <span className="null-indicator">—</span>
                                ) : typeof val === 'number' ? (
                                  val.toLocaleString()
                                ) : (
                                  String(val)
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={columns.length + 1} className="table-no-match">
                        No rows matched your search term &ldquo;{searchTerm}&rdquo;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="table-pagination-row">
                  <span className="page-indicator">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="page-nav-btn"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="page-nav-btn"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="table-empty-placeholder">
              <FileSpreadsheet size={36} className="empty-table-icon" />
              <h4>No dataset loaded yet</h4>
              <p>Upload a CSV file to inspect raw records, column datatypes, and missing fields.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
