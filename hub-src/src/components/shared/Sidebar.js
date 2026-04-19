import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useIdle } from '../../App';

function fmtIdle(secs) {
  if (secs == null) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Sidebar({ navItems, activeView, setActiveView }) {
  const { profile, signOut } = useAuth();
  const { secondsLeft } = useIdle();

  return (
    <div className="sidebar">
      {/* Logo — links back to main site */}
      <a href="https://nysterys.com" className="sidebar-logo" rel="noopener noreferrer">
        NYS<span>T</span>ERYS
        <span className="sidebar-logo-sub">Team Portal</span>
      </a>

      <div className="sidebar-user">
        <div className="sidebar-user-name">{profile?.full_name}</div>
        <div className="sidebar-user-role">
          {profile?.role === 'admin' ? 'Manager' : profile?.creator_name || 'Creator'}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section, si) => (
          <div key={si} style={{ display: 'contents' }}>
            {section.label && (
              <div className="nav-section-label">{section.label}</div>
            )}
            {section.items.map(item => (
              <div
                key={item.view}
                className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                onClick={() => setActiveView(item.view)}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
        {/* Sign out — only visible in mobile bottom nav */}
        <div className="nav-item nav-item-signout" onClick={signOut}>
          <span className="nav-item-icon">⎋</span>
          Sign Out
        </div>
      </nav>

      <div className="sidebar-footer">
        <a
          href="https://nysterys.com"
          className="sidebar-back-link"
          rel="noopener noreferrer"
        >
          ← nysterys.com
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {secondsLeft != null && (
            <span style={{
              fontSize: 10,
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums',
              color: secondsLeft < 120 ? 'var(--orange)' : 'var(--dim)',
              letterSpacing: '0.05em',
            }}>
              {fmtIdle(secondsLeft)}
            </span>
          )}
          <button className="btn-signout" onClick={signOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
