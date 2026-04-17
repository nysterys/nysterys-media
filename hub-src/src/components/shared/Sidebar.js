import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar({ navItems, activeView, setActiveView }) {
  const { profile, signOut } = useAuth();

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
          <div key={si}>
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
      </nav>

      <div className="sidebar-footer">
        <a
          href="https://nysterys.com"
          className="sidebar-back-link"
          rel="noopener noreferrer"
        >
          ← nysterys.com
        </a>
        <button className="btn-signout" onClick={signOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
