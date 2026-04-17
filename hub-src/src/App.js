import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CreatorDashboard from './pages/CreatorDashboard';
import './App.css';

function AppInner() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-logo">NYS<span>T</span>ERYS</div>
        <div className="splash-spinner" />
      </div>
    );
  }

  if (!user || !profile) return <LoginPage />;
  if (profile.role === 'admin') return <AdminDashboard />;
  return <CreatorDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
