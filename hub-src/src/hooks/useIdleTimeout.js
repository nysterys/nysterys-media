import { useEffect, useRef, useState, useCallback } from 'react';

const WARNING_SECONDS = 60;
const THROTTLE_MS = 2000;

export function useIdleTimeout({ profile, signOut }) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(WARNING_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(null);

  // Refs break the stale-closure cascade: signOut changes every render in AuthProvider
  // but using it as a dep would cause scheduleIdle → resetTimer → useEffect to re-run
  // on every render, continuously resetting the timer before it ever fires.
  const signOutRef           = useRef(signOut);
  signOutRef.current         = signOut;

  const timeoutMs = profile?.idle_timeout_minutes
    ? profile.idle_timeout_minutes * 60 * 1000
    : null;

  const timeoutMsRef         = useRef(timeoutMs);
  timeoutMsRef.current       = timeoutMs;

  const idleTimerRef         = useRef(null);
  const countdownIntervalRef = useRef(null);
  const tickIntervalRef      = useRef(null);
  const showingWarningRef    = useRef(false);
  const lastActivityRef      = useRef(Date.now());
  const deadlineRef          = useRef(null);

  // [] deps — stable forever; calls signOut via ref so no dep needed
  const startCountdown = useCallback(() => {
    showingWarningRef.current = true;
    setShowWarning(true);
    clearInterval(tickIntervalRef.current);
    setSecondsLeft(null);
    let secs = WARNING_SECONDS;
    setCountdown(secs);
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(countdownIntervalRef.current);
        setShowWarning(false);
        signOutRef.current();
      }
    }, 1000);
  }, []);

  // Stable because startCountdown is stable
  const scheduleIdle = useCallback(() => {
    const ms = timeoutMsRef.current;
    if (!ms) return;
    clearTimeout(idleTimerRef.current);
    clearInterval(tickIntervalRef.current);
    const warningDelay = Math.max(0, ms - WARNING_SECONDS * 1000);
    deadlineRef.current = Date.now() + ms;
    setSecondsLeft(Math.ceil(ms / 1000));
    idleTimerRef.current = setTimeout(startCountdown, warningDelay);
    tickIntervalRef.current = setInterval(() => {
      const secs = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(secs);
    }, 1000);
  }, [startCountdown]);

  // Stable because scheduleIdle is stable
  const resetTimer = useCallback(() => {
    if (!timeoutMsRef.current) return;
    const now = Date.now();
    if (showingWarningRef.current) {
      showingWarningRef.current = false;
      setShowWarning(false);
      setCountdown(WARNING_SECONDS);
      clearInterval(countdownIntervalRef.current);
    } else {
      if (now - lastActivityRef.current < THROTTLE_MS) return;
    }
    lastActivityRef.current = now;
    scheduleIdle();
  }, [scheduleIdle]);

  useEffect(() => {
    if (!timeoutMs) return;
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    scheduleIdle();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(idleTimerRef.current);
      clearInterval(countdownIntervalRef.current);
      clearInterval(tickIntervalRef.current);
    };
  }, [timeoutMs, resetTimer, scheduleIdle]);

  const stayLoggedIn = useCallback(() => resetTimer(), [resetTimer]);

  return { showWarning, countdown, stayLoggedIn, secondsLeft };
}
