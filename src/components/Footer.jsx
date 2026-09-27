import { BarChart3 } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="dashboard-bottom-footer" aria-label="Dashboard Footer">
      <div className="footer-left-col">
        <BarChart3 size={15} className="footer-logo-icon" />
        <span className="footer-brand-title">DataViz AI</span>
        <span className="footer-version-tag">v1.0.0</span>
      </div>

      <div className="footer-center-col">
        <span>Analyze</span>
        <span className="bullet-sep">•</span>
        <span>Visualize</span>
        <span className="bullet-sep">•</span>
        <span>Get Insights</span>
        <span className="bullet-sep">•</span>
        <span>Make Better Decisions</span>
      </div>

      <div className="footer-right-col">
        <span>Built for a Smarter Tomorrow</span>
      </div>
    </footer>
  )
}
