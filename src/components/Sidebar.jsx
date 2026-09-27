import {
  LayoutDashboard,
  Upload,
  Table2,
  LineChart,
  Bot,
  Lightbulb,
  FileText,
  Settings,
  BarChart3,
} from 'lucide-react'

export default function Sidebar({
  activeNav,
  setActiveNav,
  onTriggerUpload,
  onOpenReports,
  onOpenExplorer,
  onOpenSettings,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Data', icon: Upload, action: onTriggerUpload },
    { id: 'explorer', label: 'Data Explorer', icon: Table2, action: onOpenExplorer },
    { id: 'visualizations', label: 'Visualizations', icon: LineChart },
    { id: 'analyst', label: 'AI Analyst', icon: Bot },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'reports', label: 'Reports', icon: FileText, action: onOpenReports },
    { id: 'settings', label: 'Settings', icon: Settings, action: onOpenSettings },
  ]

  function handleNavClick(item) {
    setActiveNav(item.id)
    if (item.action) {
      item.action()
    } else {
      // Smooth scroll to relevant section if on dashboard
      if (item.id === 'visualizations') {
        document.getElementById('visualization-section')?.scrollIntoView({ behavior: 'smooth' })
      } else if (item.id === 'analyst') {
        document.getElementById('ai-analyst-panel')?.scrollIntoView({ behavior: 'smooth' })
      } else if (item.id === 'insights') {
        document.getElementById('insights-panel')?.scrollIntoView({ behavior: 'smooth' })
      } else if (item.id === 'dashboard') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  return (
    <aside className="app-sidebar" aria-label="Sidebar Navigation">
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeNav === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item)}
            >
              <Icon size={18} className="sidebar-nav-icon" />
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer-widget">
        <div className="sidebar-quote-box">
          <div className="sidebar-bars-graphic">
            <span className="bar b1" />
            <span className="bar b2" />
            <span className="bar b3" />
          </div>
          <p className="sidebar-quote-title">&ldquo;Better Data Better Decisions&rdquo;</p>
          <p className="sidebar-quote-sub">Analyze • Visualize • Grow</p>
        </div>
        <div className="sidebar-version-tag">
          <BarChart3 size={14} className="sidebar-version-icon" />
          <span>DataViz AI <span className="version-pill">v1.0.0</span></span>
        </div>
      </div>
    </aside>
  )
}
