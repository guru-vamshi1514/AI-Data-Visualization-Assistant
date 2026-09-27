import { Zap, BarChart2, CheckCircle2 } from 'lucide-react'

export default function WelcomeBanner() {
  return (
    <div className="welcome-banner-card">
      <div className="banner-content">
        <span className="banner-badge">
          WELCOME BACK, EXPLORER! 👋
        </span>
        <h1 className="banner-title">
          Turn Your Data Into <span className="gradient-text">Real Insights</span>
        </h1>
        <p className="banner-subtitle">
          Upload, explore, visualize and get AI-powered insights — all in one place.
        </p>

        <div className="banner-features-row">
          <div className="feature-pill purple">
            <Zap size={14} className="feature-icon" />
            <span>Analyze Faster</span>
          </div>
          <div className="feature-pill blue">
            <BarChart2 size={14} className="feature-icon" />
            <span>Visualize Smarter</span>
          </div>
          <div className="feature-pill green">
            <CheckCircle2 size={14} className="feature-icon" />
            <span>Make Better Decisions</span>
          </div>
        </div>
      </div>

      <div className="banner-graphic-area" aria-hidden="true">
        <div className="graphic-bars">
          <span className="gbar gb1" />
          <span className="gbar gb2" />
          <span className="gbar gb3" />
          <span className="gbar gb4" />
        </div>
        <div className="script-text">
          <span>Your Data</span>
          <span className="script-highlight">Your Story</span>
        </div>
      </div>
    </div>
  )
}
