import { useEffect } from 'react'
import { Info, X, Check } from 'lucide-react'

export default function InfoModal({ isOpen, onClose, title, subtitle, content }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content info-dialog-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="info-modal-icon-badge">
              <Info size={18} />
            </div>
            <div>
              <h3>{title}</h3>
              {subtitle && <span className="modal-subtitle">{subtitle}</span>}
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body info-modal-body">
          {typeof content === 'string' ? (
            <p className="info-modal-text">{content}</p>
          ) : (
            content
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="action-btn download-report-btn"
            onClick={onClose}
          >
            <Check size={14} />
            <span>Got it</span>
          </button>
        </div>
      </div>
    </div>
  )
}
