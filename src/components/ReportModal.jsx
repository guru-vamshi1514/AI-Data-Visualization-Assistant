import { useState } from 'react'
import { FileText, Download, Copy, Check, X } from 'lucide-react'

export default function ReportModal({ isOpen, onClose, reportText, fileName, onDownload }) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  function handleCopy() {
    if (reportText) {
      navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content report-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <FileText size={18} className="modal-icon" />
            <div>
              <h3>Automated Analytics & Profiling Report</h3>
              <span className="modal-subtitle">{fileName || 'Dataset Report'}</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Report Modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <pre className="report-pre-block">{reportText}</pre>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="action-btn copy-report-btn"
            onClick={handleCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
          </button>
          <button
            type="button"
            className="action-btn download-report-btn"
            onClick={onDownload}
          >
            <Download size={14} />
            <span>Download Report (.txt)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
