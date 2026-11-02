import { useEffect } from 'react';

export function useVisibilityPause(onHidden: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    function handleVisibility() {
      if (document.visibilityState === 'hidden') onHidden();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active, onHidden]);
}
