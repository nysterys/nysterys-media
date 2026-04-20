import React, { createContext, useContext, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreatorDashboard from './pages/CreatorDashboard';
import './App.css';

export const IdleContext = createContext({ secondsLeft: null });
export function useIdle() { return useContext(IdleContext); }

function IdleWarning({ countdown, onStayLoggedIn }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '36px 40px', maxWidth: 360, textAlign: 'center',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Still there?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
          You've been inactive for a while.<br />
          Signing out in{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {countdown}s
          </span>.
        </div>
        <button className="btn btn-primary" onClick={onStayLoggedIn} style={{ width: '100%' }}>
          Stay signed in
        </button>
      </div>
    </div>
  );
}

function AppInner() {
  const { user, profile, loading, signOut } = useAuth();
  const { showWarning, countdown, stayLoggedIn, secondsLeft } = useIdleTimeout({ profile, signOut });

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-logo">NYS<span>T</span>ERYS</div>
        <div className="splash-spinner" />
      </div>
    );
  }

  if (!user || !profile) return <LoginPage />;

  return (
    <IdleContext.Provider value={{ secondsLeft }}>
      {profile.role === 'admin' ? <AdminDashboard /> : <CreatorDashboard />}
      {showWarning && <IdleWarning countdown={countdown} onStayLoggedIn={stayLoggedIn} />}
    </IdleContext.Provider>
  );
}

function GlobalEscapeHandler() {
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      const overlays = document.querySelectorAll('.modal-overlay');
      if (overlays.length > 0) overlays[overlays.length - 1].click();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <GlobalEscapeHandler />
      <AppInner />
    </AuthProvider>
  );
}
