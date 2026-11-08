import { useEffect, useRef } from 'react';

export function useVisibilityPause(onHidden: () => void, active: boolean): void {
  const pauseRequested = useRef(false);

  useEffect(() => {
    if (!active) {
      pauseRequested.current = false;
      return;
    }

    function requestPause() {
      // Several browsers fire blur, pagehide and visibilitychange for one
      // departure. The callback is commonly a toggle, so it must run once.
      if (pauseRequested.current) return;
      pauseRequested.current = true;
      onHidden();
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') requestPause();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', requestPause);
    window.addEventListener('pagehide', requestPause);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', requestPause);
      window.removeEventListener('pagehide', requestPause);
    };
  }, [active, onHidden]);
}
