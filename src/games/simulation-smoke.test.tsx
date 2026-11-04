// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import GridSupplyGame from '../games/grid-supply/GridSupplyGame';
import AquaGridGame from '../games/aqua-grid/AquaGridGame';
import CargoRingGame from '../games/cargo-ring/CargoRingGame';
import FactoryLineGame from '../games/factory-line/FactoryLineGame';
import NeonDinerGame from '../games/neon-diner/NeonDinerGame';
import OrbitMarketGame from '../games/orbit-market/OrbitMarketGame';
import ParkPulseGame from '../games/park-pulse/ParkPulseGame';
import RiftColonyGame from '../games/rift-colony/RiftColonyGame';
import RiftHospitalGame from '../games/rift-hospital/RiftHospitalGame';
import RiftTransitGame from '../games/rift-transit/RiftTransitGame';
import SkyportGame from '../games/skyport/SkyportGame';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

function findButton(name: RegExp): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    name.test(candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''),
  );
  if (!button) throw new Error(`Button not found: ${name}`);
  return button;
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
];

describe('simulation game shells', () => {
  for (const game of GAMES) {
    it(`${game.name} starts without runtime errors`, async () => {
      await act(async () => {
        root.render(<game.Component />);
      });

      await act(async () => {
        findButton(game.start).click();
      });

      expect(container.textContent).toContain(game.name);
    });
  }
});
