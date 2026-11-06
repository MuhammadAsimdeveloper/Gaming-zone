import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Tracks whether the canvas has lost its WebGL context. Calling
 * `preventDefault` on the loss event lets the browser restore the context,
 * and Three.js re-initialises its renderer when that happens.
 */
export function useWebGLContextLoss(canvasRef: RefObject<HTMLCanvasElement | null>): boolean {
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleLost = (event: Event) => {
      event.preventDefault();
      setLost(true);
    };
    const handleRestored = () => setLost(false);

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [canvasRef]);

  return lost;
}
