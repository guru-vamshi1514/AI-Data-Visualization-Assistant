import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  User,
  Settings,
  HelpCircle,
  LogOut,
  CheckCheck,
  FileSpreadsheet,
  AlertTriangle,
  BarChart3,
  Bot,
  FileText,
  Zap,
  ShieldAlert,
  PlusCircle,
} from 'lucide-react'

export default function Header({
  apiStatus,
  onSearchSubmit,
  isDarkMode,
  setIsDarkMode,
  notifications = [],
  onMarkAllNotificationsRead,
  onSelectProfileItem,
  hasDataset = false,
  onOpenWhatIf,
  onOpenWatchdog,
  onOpenAddMetric,
}) {
  const [searchValue, setSearchValue] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const profileRef = useRef(null)
  const notificationsRef = useRef(null)
  const searchInputRef = useRef(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Global keyboard shortcut Ctrl+K to focus search, Escape to close dropdowns
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        setProfileOpen(false)
        setNotificationsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside listener for profile and notification dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && searchValue.trim()) {
      e.preventDefault()
      onSearchSubmit?.(searchValue.trim())
      setSearchValue('')
    }
  }

  function handleProfileClick(itemKey) {
    setProfileOpen(false)
    onSelectProfileItem?.(itemKey)
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'dataset':
        return <FileSpreadsheet size={15} className="notif-icon notif-blue" />
      case 'warning':
        return <AlertTriangle size={15} className="notif-icon notif-amber" />
      case 'chart':
        return <BarChart3 size={15} className="notif-icon notif-purple" />
      case 'ai':
        return <Bot size={15} className="notif-icon notif-green" />
      case 'report':
        return <FileText size={15} className="notif-icon notif-cyan" />
      default:
        return <Bell size={15} className="notif-icon notif-blue" />
    }
  }

  // Health text and subtext calculation
  let healthTitle = 'Local Fallback'
  let healthSub = 'Offline Engine'
  let healthPillClass = 'offline'

  if (apiStatus === 'ai-online') {
    healthTitle = 'AI Online'
    healthSub = 'OpenAI'
    healthPillClass = 'online'
  } else if (apiStatus === 'online') {
    healthTitle = 'API Online'
    healthSub = 'FastAPI • Port 8000'
    healthPillClass = 'online'
  } else if (apiStatus === 'checking') {
    healthTitle = 'Checking API...'
    healthSub = 'FastAPI • Port 8000'
    healthPillClass = 'checking'
  } else {
    healthTitle = 'Offline'
    healthSub = 'Local fallback available'
    healthPillClass = 'offline'
  }

  return (
    <header className="app-top-header">
      {/* LEFT: Branding */}
      <div className="header-brand-block">
        <div className="brand-logo-symbol" aria-hidden="true">
          <span className="logo-bar bar-1" />
          <span className="logo-bar bar-2" />
          <span className="logo-bar bar-3" />
          <span className="logo-bar bar-4" />
        </div>
        <div className="brand-text-block">
          <div className="brand-name">
            DataViz <span className="brand-name-ai">AI</span>
          </div>
          <span className="brand-tagline">From Data to Decisions</span>
        </div>
      </div>

      {/* CENTER: Global Search / Ask Input */}
      <div className="header-search-container">
        <div className="header-search-box">
          <Search size={16} className="header-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="header-search-input"
            placeholder="Ask anything about your data..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search or ask anything about your data"
          />
          <kbd className="header-search-shortcut">Ctrl K</kbd>
        </div>
      </div>

      {/* RIGHT: API Status, Theme, Notifications, User Profile */}
      <div className="header-actions-block">
        {/* Quick Decision & Simulation Tools */}
        {hasDataset && (
          <div className="header-quick-tools">
            <button
              type="button"
              className="quick-tool-btn whatif-btn"
              onClick={onOpenWhatIf}
              title="Interactive Scenario Simulator (What-If Levers)"
            >
              <Zap size={14} className="tool-icon" />
              <span>What-If</span>
            </button>
            <button
              type="button"
              className="quick-tool-btn watchdog-btn"
              onClick={onOpenWatchdog}
              title="Automated Risk & Loss Watchdog Panel"
            >
              <ShieldAlert size={14} className="tool-icon" />
              <span>Risk Watchdog</span>
            </button>
            <button
              type="button"
              className="quick-tool-btn calc-metric-btn"
              onClick={onOpenAddMetric}
              title="Add Calculated Metric / Custom Formula"
            >
              <PlusCircle size={14} className="tool-icon" />
              <span>+ Metric</span>
            </button>
          </div>
        )}

        {/* API Status Badge */}
        <div
          className={`api-health-pill ${healthPillClass}`}
          title={
            apiStatus === 'ai-online'
              ? 'FastAPI backend connected with active OpenAI LLM support.'
              : apiStatus === 'online'
              ? 'FastAPI backend online at http://127.0.0.1:8000. Rule-based offline intelligence active.'
              : 'Backend unreachable. Running seamlessly via browser-side Local Analytics Engine.'
          }
        >
          <span className="health-dot" />
          <div className="health-text">
            <strong className="health-title">{healthTitle}</strong>
            <span className="health-sub">{healthSub}</span>
          </div>
        </div>

        {/* Notifications Dropdown Container */}
        <div className="header-dropdown-anchor" ref={notificationsRef}>
          <button
            type="button"
            className={`header-icon-btn notifications-btn ${notificationsOpen ? 'active' : ''}`}
            onClick={() => {
              setNotificationsOpen((prev) => !prev)
              setProfileOpen(false)
            }}
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>

          {notificationsOpen && (
            <div className="dropdown-panel notifications-dropdown-panel" role="menu">
              <div className="dropdown-panel-header">
                <div className="dropdown-header-title">
                  <strong>Notifications</strong>
                  {unreadCount > 0 && <span className="unread-count-badge">{unreadCount} new</span>}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="mark-all-read-btn"
                    onClick={onMarkAllNotificationsRead}
                  >
                    <CheckCheck size={13} />
                    <span>Mark all as read</span>
                  </button>
                )}
              </div>

              <div className="notifications-stream">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                    >
                      <div className="notif-icon-col">{getNotificationIcon(notif.type)}</div>
                      <div className="notif-body-col">
                        <div className="notif-title-row">
                          <strong className="notif-title">{notif.title}</strong>
                          <span className="notif-time">{notif.time}</span>
                        </div>
                        <p className="notif-message">{notif.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-notifications-box">
                    <Bell size={24} className="empty-bell-icon" />
                    <p className="empty-notif-title">No new notifications</p>
                    <span className="empty-notif-sub">
                      Events like CSV uploads, outlier alerts, and report generations will appear here.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          className="header-icon-btn theme-toggle-btn"
          onClick={() => setIsDarkMode?.(!isDarkMode)}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User Profile Dropdown Container */}
        <div className="header-dropdown-anchor" ref={profileRef}>
          <button
            type="button"
            className={`user-profile-menu ${profileOpen ? 'active' : ''}`}
            onClick={() => {
              setProfileOpen((prev) => !prev)
              setNotificationsOpen(false)
            }}
            aria-expanded={profileOpen}
            aria-haspopup="true"
            aria-label="User Profile Menu"
          >
            <div className="user-avatar-circle">
              <span>GV</span>
            </div>
            <div className="user-info-text">
              <span className="user-full-name">Guru Vamshi</span>
              <span className="user-role-label">Student</span>
            </div>
            <ChevronDown size={14} className={`user-chevron ${profileOpen ? 'rotate' : ''}`} />
          </button>

          {profileOpen && (
            <div className="dropdown-panel profile-dropdown-panel" role="menu">
              <div className="profile-dropdown-user-header">
                <div className="profile-avatar-large">GV</div>
                <div className="profile-user-details">
                  <strong className="profile-name">Guru Vamshi</strong>
                  <span className="profile-email">Student · Local Workspace</span>
                </div>
              </div>

              <div className="dropdown-divider" />

              <div className="dropdown-items-group">
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => handleProfileClick('profile')}
                >
                  <User size={15} className="dropdown-item-icon" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => handleProfileClick('settings')}
                >
                  <Settings size={15} className="dropdown-item-icon" />
                  <span>Account Settings</span>
                </button>
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => handleProfileClick('help')}
                >
                  <HelpCircle size={15} className="dropdown-item-icon" />
                  <span>Help / About</span>
                </button>
              </div>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item-btn logout-item-btn"
                role="menuitem"
                onClick={() => handleProfileClick('logout')}
              >
                <LogOut size={15} className="dropdown-item-icon logout-icon" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
