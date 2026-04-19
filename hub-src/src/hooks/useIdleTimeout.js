import { useEffect, useRef, useState, useCallback } from 'react';

const WARNING_SECONDS = 60;
const THROTTLE_MS = 2000;

export function useIdleTimeout({ profile, signOut }) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(WARNING_SECONDS);

  const idleTimerRef        = useRef(null);
  const countdownIntervalRef = useRef(null);
  const showingWarningRef   = useRef(false);
  const lastActivityRef     = useRef(Date.now());

  const timeoutMs = profile?.idle_timeout_minutes
    ? profile.idle_timeout_minutes * 60 * 1000
    : null;

  const clearAll = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearInterval(countdownIntervalRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    showingWarningRef.current = true;
    setShowWarning(true);
    let secs = WARNING_SECONDS;
    setCountdown(secs);
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(countdownIntervalRef.current);
        setShowWarning(false);
        signOut();
      }
    }, 1000);
  }, [signOut]);

  const scheduleIdle = useCallback(() => {
    if (!timeoutMs) return;
    clearTimeout(idleTimerRef.current);
    const delay = Math.max(0, timeoutMs - WARNING_SECONDS * 1000);
    idleTimerRef.current = setTimeout(startCountdown, delay);
  }, [timeoutMs, startCountdown]);

  const resetTimer = useCallback(() => {
    if (!timeoutMs) return;
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
  }, [timeoutMs, scheduleIdle]);

  useEffect(() => {
    if (!timeoutMs) return;
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    scheduleIdle();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearAll();
    };
  }, [timeoutMs, resetTimer, scheduleIdle, clearAll]);

  const stayLoggedIn = useCallback(() => resetTimer(), [resetTimer]);

  return { showWarning, countdown, stayLoggedIn };
}
