// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import AquaGridGame from '../games/aqua-grid/AquaGridGame';
import CargoRingGame from '../games/cargo-ring/CargoRingGame';
import FactoryLineGame from '../games/factory-line/FactoryLineGame';
import GridSupplyGame from '../games/grid-supply/GridSupplyGame';
import NeonDinerGame from '../games/neon-diner/NeonDinerGame';
import OrbitMarketGame from '../games/orbit-market/OrbitMarketGame';
import ParkPulseGame from '../games/park-pulse/ParkPulseGame';
import RiftColonyGame from '../games/rift-colony/RiftColonyGame';
import RiftEcologyGame from '../games/rift-ecology/RiftEcologyGame';
import RiftHospitalGame from '../games/rift-hospital/RiftHospitalGame';
import RiftLifeGame from '../games/rift-life/RiftLifeGame';
import RiftRunnerGame from '../games/rift-runner/RiftRunnerGame';
import RiftTacticsGame from '../games/rift-tactics/RiftTacticsGame';
import RiftTransitGame from '../games/rift-transit/RiftTransitGame';
import RiftfallGame from '../games/riftfall/RiftfallGame';
import SignalStackGame from '../games/signal-stack/SignalStackGame';
import SkyportGame from '../games/skyport/SkyportGame';

let container: HTMLDivElement;
let root: Root;
let errorSpy: MockInstance<typeof console.error>;
const animationFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  vi.useFakeTimers();
  animationFrames.clear();
  nextFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrameId += 1;
    animationFrames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    animationFrames.delete(handle);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  errorSpy.mockRestore();
});

function findStartButton(name: RegExp, optional = false): HTMLButtonElement | undefined {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    name.test(candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''),
  );
  if (!button && !optional) throw new Error(`Button not found: ${name}`);
  return button;
}

function statusText(): string {
  return container.querySelector('[role="status"]')?.textContent?.trim() ?? '';
}

async function runFrames(count: number) {
  await act(async () => {
    const base = performance.now();
    for (let frame = 1; frame <= count; frame += 1) {
      const callbacks = [...animationFrames.values()];
      animationFrames.clear();
      for (const callback of callbacks) callback(base + frame * 16);
    }
  });
}

const GAMES = [
  { name: 'Rift Transit', Component: RiftTransitGame, start: /Start service/ },
  { name: 'Grid Supply', Component: GridSupplyGame, start: /Start grid/ },
  { name: 'Rift Colony', Component: RiftColonyGame, start: /Start colony/ },
  { name: 'Orbit Market', Component: OrbitMarketGame, start: /Start trading/ },
  { name: 'Neon Diner', Component: NeonDinerGame, start: /Open diner/ },
  { name: 'Skyport', Component: SkyportGame, start: /Start tower/ },
  { name: 'Rift Hospital', Component: RiftHospitalGame, start: /Open clinic/ },
  { name: 'Park Pulse', Component: ParkPulseGame, start: /Open park/ },
  { name: 'Factory Line', Component: FactoryLineGame, start: /Start line/ },
  { name: 'Cargo Ring', Component: CargoRingGame, start: /Open depot/ },
  { name: 'Aqua Grid', Component: AquaGridGame, start: /Start grid/ },
  { name: 'Signal Stack', Component: SignalStackGame, start: /Start stacking/ },
  { name: 'Rift Runner', Component: RiftRunnerGame, start: /Start run/ },
  { name: 'Rift Tactics', Component: RiftTacticsGame, start: /Start battle/ },
  { name: 'Riftfall', Component: RiftfallGame, start: /Start run/ },
  { name: 'Rift Life', Component: RiftLifeGame, start: /Start the 21 days/ },
  { name: 'Rift Ecology', Component: RiftEcologyGame, start: /Start season/ },
];

describe('simulation game shells', () => {
  for (const game of GAMES) {
    it(`${game.name} leaves its start state and ticks without runtime errors`, async () => {
      await act(async () => {
        root.render(<game.Component />);
      });

      const readyStatus = statusText();
      expect(readyStatus.length).toBeGreaterThan(0);
      const startButton = findStartButton(game.start);
      expect(startButton).toBeDefined();

      await act(async () => {
        startButton!.click();
      });

      expect(findStartButton(game.start, true)).toBeUndefined();
      expect(statusText()).not.toBe(readyStatus);

      await act(async () => {
        vi.advanceTimersByTime(2500);
      });
      await runFrames(4);

      expect(statusText().length).toBeGreaterThan(0);
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.textContent).toContain(game.name);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  }
});
