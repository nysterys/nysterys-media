import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export default function LoginPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Client-side brute force throttle
  const attemptsRef = useRef(0);
  const lockoutRef = useRef(null);

  function isLockedOut() {
    if (!lockoutRef.current) return false;
    if (Date.now() - lockoutRef.current < LOCKOUT_MS) return true;
    lockoutRef.current = null;
    attemptsRef.current = 0;
    return false;
  }

  function remainingLockout() {
    if (!lockoutRef.current) return 0;
    return Math.ceil((LOCKOUT_MS - (Date.now() - lockoutRef.current)) / 60000);
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (isLockedOut()) {
      setError(`Too many failed attempts. Try again in ${remainingLockout()} minute(s).`);
      return;
    }
    setLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        lockoutRef.current = Date.now();
        setError(`Too many failed attempts. Account locked for 15 minutes.`);
      } else {
        // Generic error — don't reveal whether email exists
        setError(`Invalid credentials. ${MAX_ATTEMPTS - attemptsRef.current} attempt(s) remaining.`);
      }
    } else {
      attemptsRef.current = 0;
    }
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true);
    setError('');
    setSuccess('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/hub/`,
    });

    if (resetError) {
      // Don't reveal whether email exists — always show success
      console.warn('Reset error (not shown to user):', resetError.message);
    }

    setSuccess('If that email is registered, you\'ll receive a reset link shortly.');
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-box">
        {/* Logo — matches nysterys.com nav-logo exactly */}
        <a href="https://nysterys.com" style={{ textDecoration: 'none' }}>
          <div className="login-logo">NYS<span>T</span>ERYS</div>
        </a>
        <div className="login-tagline">
          {mode === 'login' ? 'Team Portal' : 'Password Reset'}
        </div>
        <div className="login-divider" />

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} autoComplete="on">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@nysterys.com"
                required
                autoFocus
                autoComplete="email"
                disabled={loading || isLockedOut()}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                disabled={loading || isLockedOut()}
              />
            </div>
            <button
              className="btn btn-primary w-full mt-8"
              type="submit"
              disabled={loading || isLockedOut()}
              style={{ justifyContent: 'center' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="login-footer-link"
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} autoComplete="on">
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@nysterys.com"
                required
                autoFocus
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <button
              className="btn btn-primary w-full mt-8"
              type="submit"
              disabled={loading}
              style={{ justifyContent: 'center' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              className="login-footer-link"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              ← Back to sign in
            </button>
          </form>
        )}

        <a href="https://nysterys.com" className="login-back-link">
          ← nysterys.com
        </a>
      </div>
    </div>
  );
}
