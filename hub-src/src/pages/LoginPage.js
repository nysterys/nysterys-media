import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, setHandlingPasswordReset } from '../lib/supabase';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export default function LoginPage() {
  const { signIn } = useAuth();

  const [mode, setMode]                       = useState('login');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState('');
  const [loading, setLoading]                 = useState(false);

  const attemptsRef = useRef(0);
  const lockoutRef  = useRef(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params      = new URLSearchParams(hash.substring(1));
    const type         = params.get('type');
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type === 'recovery' && accessToken && refreshToken) {
      // Tell useAuth to ignore SIGNED_IN events while we handle this
      setHandlingPasswordReset(true);

      // Clear tokens from URL — one-time use
      window.history.replaceState(null, '', window.location.pathname);

      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ error: sessionError }) => {
        if (sessionError) {
          setHandlingPasswordReset(false);
          setError('Reset link is invalid or expired. Request a new one.');
          setMode('reset');
        } else {
          // Session established — show set-password form
          // Keep isHandlingPasswordReset = true until user sets password
          setMode('set-password');
        }
      });
    }
  }, []);

  function isLockedOut() {
    if (!lockoutRef.current) return false;
    if (Date.now() - lockoutRef.current < LOCKOUT_MS) return true;
    lockoutRef.current = null;
    attemptsRef.current = 0;
    return false;
  }

  function remainingLockout() {
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
        setError('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        setError(`Invalid credentials. ${MAX_ATTEMPTS - attemptsRef.current} attempt(s) remaining.`);
      }
    } else {
      attemptsRef.current = 0;
    }
    setLoading(false);
  }

  async function handleRequestReset(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/hub/`,
    });
    setSuccess("If that email is registered you'll receive a reset link shortly.");
    setLoading(false);
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 12) { setError('Password must be at least 12 characters.'); return; }
    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
    } else {
      // Password set — clear the flag and sign out so user logs in fresh
      setHandlingPasswordReset(false);
      await supabase.auth.signOut();
      setSuccess('Password set. Sign in with your new password.');
      setMode('login');
      setNewPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  }

  const taglines = {
    'login':        'Team Portal',
    'reset':        'Password Reset',
    'set-password': 'Set New Password',
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <a href="https://nysterys.com" style={{ textDecoration: 'none' }}>
          <div className="login-logo">NYS<span>T</span>ERYS</div>
        </a>
        <div className="login-tagline">{taglines[mode] || 'Team Portal'}</div>
        <div className="login-divider" />

        {error   && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin} autoComplete="on">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@nysterys.com"
                required autoFocus autoComplete="email" disabled={loading || isLockedOut()} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••••••"
                required autoComplete="current-password" disabled={loading || isLockedOut()} />
            </div>
            <button className="btn btn-primary w-full mt-8" type="submit"
              disabled={loading || isLockedOut()} style={{ justifyContent: 'center' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button type="button" className="login-footer-link"
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}>
              Forgot password?
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleRequestReset} autoComplete="on">
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email</label>
              <input id="reset-email" className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@nysterys.com"
                required autoFocus autoComplete="email" disabled={loading} />
            </div>
            <button className="btn btn-primary w-full mt-8" type="submit"
              disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" className="login-footer-link"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
              ← Back to sign in
            </button>
          </form>
        )}

        {mode === 'set-password' && (
          <form onSubmit={handleSetPassword} autoComplete="new-password">
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input id="new-password" className="form-input" type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="12+ characters"
                required autoFocus autoComplete="new-password" disabled={loading} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input id="confirm-password" className="form-input" type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} placeholder="Same password again"
                required autoComplete="new-password" disabled={loading} />
            </div>
            <button className="btn btn-primary w-full mt-8" type="submit"
              disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Setting password...' : 'Set Password'}
            </button>
          </form>
        )}

        <a href="https://nysterys.com" className="login-back-link">← nysterys.com</a>
      </div>
    </div>
  );
}
