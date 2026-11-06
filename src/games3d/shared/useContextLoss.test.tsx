// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWebGLContextLoss } from './useContextLoss';
import { WebGLContextNotice } from './WebGLContextNotice';

describe('useWebGLContextLoss', () => {
  let container: HTMLDivElement;
  let root: Root;
  let canvas: HTMLCanvasElement;
  let lost: boolean;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    canvas = document.createElement('canvas');
    container.append(canvas);
    root = createRoot(container);
    lost = false;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function Probe() {
    const canvasRef = { current: canvas };
    lost = useWebGLContextLoss(canvasRef);
    return null;
  }

  it('flags a lost context and clears it when the context comes back', () => {
    act(() => root.render(<Probe />));
    expect(lost).toBe(false);

    const loss = new Event('webglcontextlost', { cancelable: true });
    act(() => {
      canvas.dispatchEvent(loss);
    });
    expect(loss.defaultPrevented).toBe(true);
    expect(lost).toBe(true);

    act(() => {
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    });
    expect(lost).toBe(false);
  });

  it('renders a status message only while the context is lost', () => {
    act(() => root.render(<WebGLContextNotice lost />));
    expect(container.textContent).toContain('Restoring');

    act(() => root.render(<WebGLContextNotice lost={false} />));
    expect(container.textContent).toBe('');
  });
});
