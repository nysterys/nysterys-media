import { useEffect } from 'react';

export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      // Yield to the global modal-overlay handler if a modal is open
      if (document.querySelector('.modal-overlay')) return;
      onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}
