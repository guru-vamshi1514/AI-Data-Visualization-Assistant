import { useEffect } from 'react'
import { Settings, X, Check, Server, Palette, FileSpreadsheet, ShieldCheck } from 'lucide-react'

export default function SettingsModal({
  isOpen,
  onClose,
  apiStatus,
  isDarkMode,
  setIsDarkMode,
  apiBaseUrl,
}) {
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
        className="modal-content settings-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <Settings size={18} className="modal-icon" />
            <div>
              <h3>Application Settings</h3>
              <span className="modal-subtitle">Environment, Engine, and Preferences</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Settings Modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body settings-modal-body">
          <div className="settings-section">
            <div className="settings-section-title">
              <Server size={15} />
              <h4>Backend & API Connection</h4>
            </div>
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">FastAPI Endpoint</span>
                <span className="settings-sub">Local REST API server location</span>
              </div>
              <div className="settings-control-col">
                <code className="settings-code-pill">{apiBaseUrl}</code>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Connection Status</span>
                <span className="settings-sub">Real-time health check response</span>
              </div>
              <div className="settings-control-col">
                <span
                  className={`status-pill ${
                    apiStatus === 'ai-online' || apiStatus === 'online' ? 'online' : 'offline'
                  }`}
                >
                  {apiStatus === 'ai-online'
                    ? 'Connected (OpenAI Active)'
                    : apiStatus === 'online'
                    ? 'Connected (FastAPI Active)'
                    : 'Offline (Local Fallback Active)'}
                </span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              <Palette size={15} />
              <h4>Appearance & Theme</h4>
            </div>
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Interface Theme</span>
                <span className="settings-sub">Toggle between crisp light and dark aesthetic</span>
              </div>
              <div className="settings-control-col">
                <div className="theme-toggle-switch-wrapper">
                  <button
                    type="button"
                    className={`theme-option-btn ${!isDarkMode ? 'active' : ''}`}
                    onClick={() => setIsDarkMode?.(false)}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={`theme-option-btn ${isDarkMode ? 'active' : ''}`}
                    onClick={() => setIsDarkMode?.(true)}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              <ShieldCheck size={15} />
              <h4>Analytics Configuration</h4>
            </div>
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Anomaly Detection Method</span>
                <span className="settings-sub">Tukey Fence IQR statistical multiplier</span>
              </div>
              <div className="settings-control-col">
                <span className="settings-badge">1.5 × IQR</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-label-col">
                <span className="settings-label">Data Privacy</span>
                <span className="settings-sub">Processing location</span>
              </div>
              <div className="settings-control-col">
                <span className="settings-badge green">100% Local / Zero telemetry</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="action-btn download-report-btn"
            onClick={onClose}
          >
            <Check size={14} />
            <span>Close Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
