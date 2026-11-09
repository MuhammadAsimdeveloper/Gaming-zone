# Neon Coast Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing 3D games and ship Neon Coast: After Hours, one playable Canvas 2D open-district adventure in Solara Bay.

**Architecture:** Phase 1 adds three small shared 3D helpers (animation loop, HUD pump, checkpoint progression) and wires them into the existing engines without changing their simulation. Phase 2 builds Neon Coast as a framework-free deterministic simulation (`world`, `player`, `vehicle`, `traffic`, `missions`, `simulation`) with a thin Canvas 2D engine and a React shell, following the module rules in `docs/research/ARCHITECTURE.md`.

**Tech Stack:** React 19, TypeScript 5.9 strict, Vite 8, Tailwind 4, Vitest 5, Playwright 1.64, Canvas 2D, Web Audio. No new runtime dependencies.

**Spec:** [2026-11-09-neon-coast-design.md](../specs/2026-11-09-neon-coast-design.md)

## Global Constraints

- No new runtime dependencies; no proprietary assets, maps, characters, vehicles, scripts, logos, sounds or music.
- Engine modules must not import React.
- Fixed timestep 1/60 s, bounded frame delta, seeded deterministic randomness, no `Math.random()` in simulation code.
- Namespace storage keys `neonrift:game:neon-coast:` and version every payload.
- Local progression only; no backend, cloud save, leaderboard or simulated players.
- Do not change unrelated games; do not remove tests or weaken assertions.
- Every unit test must be seen failing before the implementation exists.
- Every commit runs `npm run typecheck && npm test`; the final milestone also runs build, bundle budget and Playwright.
- Push to `feat/neon-coast` after each milestone. Never force-push.

---

### Task 1: Shared animation loop and finished-game lifecycle

**Files:**
- Create: `src/games3d/shared/animationLoop.ts`
- Create: `src/games3d/shared/animationLoop.test.ts`
- Modify: `src/games3d/driving/engine.ts`, `src/games3d/racing/engine.ts`, `src/games3d/time-trial/engine.ts`, `src/games3d/football/engine.ts`, `src/games3d/rally/engine.ts`, `src/games3d/street-cricket/engine.ts`

**Interfaces:**
- Produces: `class AnimationLoop { constructor(setAnimationLoop: (callback: (() => void) | null) => void); get running(): boolean; start(callback: () => void): void; stop(): void; }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { AnimationLoop } from './animationLoop';

describe('AnimationLoop', () => {
  it('releases the renderer loop when stopped', () => {
    const calls: Array<(() => void) | null> = [];
    const loop = new AnimationLoop((callback) => calls.push(callback));
    const frame = () => undefined;

    loop.start(frame);
    expect(loop.running).toBe(true);
    expect(calls).toEqual([frame]);

    loop.stop();
    expect(loop.running).toBe(false);
    expect(calls).toEqual([frame, null]);
  });

  it('can be started again with a new callback', () => {
    const calls: Array<(() => void) | null> = [];
    const loop = new AnimationLoop((callback) => calls.push(callback));
    const first = () => undefined;
    const second = () => undefined;

    loop.start(first);
    loop.stop();
    loop.start(second);

    expect(loop.running).toBe(true);
    expect(calls).toEqual([first, null, second]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npm test -- animationLoop` reports the module does not exist.

- [ ] **Step 3: Implement**

```ts
export class AnimationLoop {
  private active = false;

  constructor(private readonly setAnimationLoop: (callback: (() => void) | null) => void) {}

  get running(): boolean {
    return this.active;
  }

  start(callback: () => void): void {
    this.active = true;
    this.setAnimationLoop(callback);
  }

  stop(): void {
    this.active = false;
    this.setAnimationLoop(null);
  }
}
```

- [ ] **Step 4: Wire every 3D engine**

In each engine constructor replace `this.renderer.setAnimationLoop(this.loop);` with
`this.frameLoop = new AnimationLoop((callback) => this.renderer.setAnimationLoop(callback)); this.frameLoop.start(this.loop);`.
Add `private frameLoop: AnimationLoop;`. In `dispose()` replace `this.renderer.setAnimationLoop(null);` with `this.frameLoop.stop();`.
In the finish path (`finishRace`, `finishMatch`, `finishRun`, `finish`, `finishRacer`, street-cricket's match end) add, after setting the finished phase:

```ts
this.frameLoop.stop();
this.audio.suspend();
```

- [ ] **Step 5: Verify** — `npm test -- animationLoop`, then `npm run typecheck`.

- [ ] **Step 6: Commit** — `git commit -m "fix(3d): stop rendering and suspend audio when a run finishes"`

---

### Task 2: HUD pump removes redundant React renders

**Files:**
- Create: `src/games3d/shared/hud.ts`
- Create: `src/games3d/shared/hud.test.ts`
- Modify: `src/games3d/driving/engine.ts`, `src/games3d/racing/engine.ts`, `src/games3d/time-trial/engine.ts`

**Interfaces:**
- Produces: `function hudEqual(a: unknown, b: unknown): boolean`
- Produces: `class HudPump<T> { constructor(emit: (hud: T) => void, intervalSeconds?: number); reset(): void; push(deltaSeconds: number, build: () => T, force?: boolean): boolean; }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { HudPump, hudEqual } from './hud';

describe('HudPump', () => {
  it('emits at a bounded rate and skips identical payloads', () => {
    const seen: Array<{ speed: number }> = [];
    const pump = new HudPump<{ speed: number }>((hud) => seen.push(hud), 0.1);
    let speed = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      pump.push(1 / 60, () => ({ speed }));
    }
    expect(seen.length).toBe(10);

    speed = 4;
    for (let frame = 0; frame < 6; frame += 1) {
      pump.push(1 / 60, () => ({ speed }));
    }
    expect(seen.length).toBe(11);

    pump.push(1 / 60, () => ({ speed }), true);
    expect(seen.length).toBe(12);
  });

  it('compares nested payloads structurally', () => {
    expect(hudEqual({ a: 1, list: [1, 2] }, { a: 1, list: [1, 2] })).toBe(true);
    expect(hudEqual({ a: 1, list: [1, 2] }, { a: 1, list: [1, 3] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement**

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hudEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => hudEqual(value, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => hudEqual(a[key], b[key]));
  }
  return false;
}

export class HudPump<T> {
  private elapsed = 0;
  private last: T | null = null;

  constructor(private readonly emit: (hud: T) => void, private readonly intervalSeconds = 0.1) {}

  reset(): void {
    this.elapsed = 0;
    this.last = null;
  }

  push(deltaSeconds: number, build: () => T, force = false): boolean {
    this.elapsed += deltaSeconds;
    if (!force && this.elapsed < this.intervalSeconds) return false;
    this.elapsed = 0;
    const next = build();
    if (!force && this.last !== null && hudEqual(this.last, next)) return false;
    this.last = next;
    this.emit(next);
    return true;
  }
}
```

- [ ] **Step 4: Replace per-frame emissions**
  - Driving: delete `hudTimer`; construct `private hudPump = new HudPump<DriveHud>((hud) => this.callbackHud(hud), 0.1);` and call `this.hudPump.push(delta, () => this.snapshotHud())` at the end of the loop. Split the existing `emitHud` body into `private snapshotHud(): DriveHud`; keep `emitHud()` as `this.hudPump.push(0, () => this.snapshotHud(), true)`.
  - Racing and time trial: remove the `emitHud()` calls inside the countdown branch; call `this.hudPump.push(delta, () => this.snapshotHud(), this.phase === 'countdown')` once per frame at the end (the countdown display only changes on integer steps, so the equality check suppresses the rest).
- [ ] **Step 5: Verify** — tests, typecheck, and drive the three games in the browser checking the HUD still updates.
- [ ] **Step 6: Commit** — `git commit -m "perf(3d): throttle HUD emission and skip identical React updates"`

---

### Task 3: Checkpoint progression and mute restart proof

**Files:**
- Create: `src/games3d/driving/progress.ts`
- Create: `src/games3d/driving/progress.test.ts`
- Create: `src/games3d/shared/audio.test.ts`
- Modify: `src/games3d/driving/engine.ts`

**Interfaces:**
- Produces: `interface CheckpointStep { index: number; complete: boolean; }`
- Produces: `function advanceCheckpoint(index: number, position: { x: number; z: number }, route: ReadonlyArray<{ x: number; z: number }>, radius: number): CheckpointStep`

- [ ] **Step 1: Write the failing checkpoint test**

```ts
import { describe, expect, it } from 'vitest';
import { DRIVE_CHECKPOINT_RADIUS, DRIVE_MISSIONS, DRIVE_SPAWN } from './city';
import { advanceCheckpoint } from './progress';

const mission = DRIVE_MISSIONS[0]!;

describe('Neon City Drive checkpoint progression', () => {
  it('does not advance while the car sits at spawn', () => {
    let index = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      index = advanceCheckpoint(index, DRIVE_SPAWN, mission.route, DRIVE_CHECKPOINT_RADIUS).index;
    }
    expect(index).toBe(0);
  });

  it('only advances when the car actually reaches the gate', () => {
    const first = mission.route[0]!;
    const halfway = { x: (DRIVE_SPAWN.x + first.x) / 2, z: (DRIVE_SPAWN.z + first.z) / 2 };

    expect(advanceCheckpoint(0, halfway, mission.route, DRIVE_CHECKPOINT_RADIUS).index).toBe(0);

    const reached = advanceCheckpoint(0, first, mission.route, DRIVE_CHECKPOINT_RADIUS);
    expect(reached).toEqual({ index: 1, complete: false });
  });

  it('reports completion after the last gate', () => {
    const last = mission.route.length - 1;
    expect(advanceCheckpoint(last, mission.route[last]!, mission.route, DRIVE_CHECKPOINT_RADIUS)).toEqual({
      index: mission.route.length,
      complete: true,
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement**

```ts
export interface CheckpointStep {
  index: number;
  complete: boolean;
}

export function advanceCheckpoint(
  index: number,
  position: { x: number; z: number },
  route: ReadonlyArray<{ x: number; z: number }>,
  radius: number,
): CheckpointStep {
  const target = route[index];
  if (!target) return { index, complete: true };
  const distance = Math.hypot(position.x - target.x, position.z - target.z);
  if (distance > radius) return { index, complete: false };
  const next = index + 1;
  return { index: next, complete: next >= route.length };
}
```

- [ ] **Step 4: Use it in `checkCheckpoint`** — replace the inline distance check with `advanceCheckpoint`; when `complete` is true call `finish(true)`, otherwise show the checkpoint message and move the gate. No other behaviour changes.

- [ ] **Step 5: Write the failing mute restart test** (jsdom). Install a fake `AudioContext` that records the master gain:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { GameAudio } from './audio';
import { writeMutedPreference } from './mutePreference';

class FakeParam {
  value = 0;
  setTargetAtTime(value: number) {
    this.value = value;
  }
}
class FakeGain {
  gain = new FakeParam();
  connect() {}
}
class FakeOscillator {
  frequency = new FakeParam();
  type = 'sine';
  connect() {}
  start() {}
  stop() {}
}
class FakeFilter {
  frequency = new FakeParam();
  Q = new FakeParam();
  type = 'lowpass';
  connect() {}
}
class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  createGain() { return new FakeGain(); }
  createOscillator() { return new FakeOscillator(); }
  createBiquadFilter() { return new FakeFilter(); }
  createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

describe('audio mute survives an engine restart', () => {
  beforeEach(() => {
    window.localStorage.clear();
    (window as unknown as { AudioContext: typeof FakeContext }).AudioContext = FakeContext;
  });

  it('creates the next engine silent and keeps the visible state honest', () => {
    writeMutedPreference(true);
    const first = new GameAudio();
    expect(first.isMuted).toBe(true);
    first.start();
    expect(first.toggleMute()).toBe(false);

    const second = new GameAudio();
    expect(second.isMuted).toBe(false);
    expect(second.toggleMute()).toBe(true);
    expect(new GameAudio().isMuted).toBe(true);
  });
});
```

- [ ] **Step 6: Run it, confirm RED, then make it pass.** The constructor already reads the stored preference; if the test exposes a gap (for example, a UI state that never re-syncs), fix the shell so `setMuted(engineRef.current?.isMuted ?? readMutedPreference())` runs after every engine creation.
- [ ] **Step 7: Commit** — `git commit -m "test(3d): prove checkpoint reach and mute persistence across restarts"`

---

### Task 4: Real-input browser coverage for the 3D games

**Files:**
- Create: `e2e/gameplay3d.spec.ts`
- Modify: `e2e/gameplay.spec.ts` (Riftfall: dismiss a pending upgrade overlay before pausing)
- Modify: `playwright.config.ts` (local workers cap at 4 to keep heavy 3D chunks from starving each other)

- [ ] **Step 1: Write the failing spec**

```ts
import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

test('Neon City Drive moves on real input and progresses through a gate', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/game/neon-city-drive');
  await page.getByRole('button', { name: 'Start drive', exact: true }).click();

  const canvas = page.getByLabel(/Neon City Drive/);
  await expect(canvas).toBeVisible();
  await expect(page.getByText('Engine hot')).toBeVisible();
  await expect(page.getByText('Engine hot')).toBeHidden({ timeout: 8000 });

  const player = page.locator('svg[aria-label="City minimap with your car, traffic and the next gate"] polygon');
  const before = await player.getAttribute('transform');
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => page.locator('svg[aria-label="City minimap with your car, traffic and the next gate"] polygon').getAttribute('transform'), {
      timeout: 6000,
    })
    .not.toBe(before);
  await expect(page.getByText(/km\/h/)).toBeVisible();
  await expect(page.locator('p', { hasText: /^Gate 2/ })).toBeVisible({ timeout: 20000 });
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyP');
  await expect(page.getByRole('dialog', { name: 'Drive paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.keyboard.press('KeyP');
  await page.getByRole('button', { name: 'Restart run' }).click();
  await expect(page.getByText('Engine hot')).toBeVisible();

  expectNoErrors(errors);
});

test('3D mute survives a reload', async ({ page }) => {
  await page.goto('/game/neon-city-drive');
  await page.getByRole('button', { name: 'Start drive', exact: true }).click();
  await page.getByRole('button', { name: 'Mute sound' }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Start drive', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible();
});

test('Rift Striker reacts to a real kick input', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/game/rift-striker');
  await page.getByRole('button', { name: 'Kick off', exact: true }).click();
  const canvas = page.getByLabel(/Rift Striker/i);
  await expect(canvas).toBeVisible();
  await canvas.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(300);
  await page.keyboard.up('Space');
  await expect(page.getByRole('button', { name: 'Pause match' })).toBeVisible();
  expectNoErrors(errors);
});
```

- [ ] **Step 2: Run it, confirm it fails for the right reason** (Gate 2 not reached, or the mute button label is wrong), then fix only real gaps.
- [ ] **Step 3: Re-run it until green, then run the three previously flaky specs in isolation.**
- [ ] **Step 4: Commit** — `git commit -m "test(3d): assert real movement, checkpoint progression and mute persistence"`

---

### Task 5: Neon Coast world model

**Files:**
- Create: `src/games/neon-coast/world.ts`
- Create: `src/games/neon-coast/world.test.ts`

**Interfaces:**
- Produces: `WORLD_WIDTH`, `WORLD_HEIGHT`, `ROAD_HALF_WIDTH`, `type Landmark`, `type District = { roads: Road[]; blocks: Block[]; props: Rect[]; landmarks: Landmark[]; spawn: Point; carSpawn: Point }`
- Produces: `VE LA_DISTRICT: District`, `SOLARA_LANDMARKS`, `collideCircle(rects, x, y, radius): { x: number; y: number; hit: boolean }`, `isOnRoad(x, y): boolean`, `landmarkAt(x, y, radius): Landmark | null`

Exact data: eight landmarks from the spec at their stated coordinates; roads at x = 260/860/1460/2060 and y = 260/760/1260/1760 with half-width 70; spawn (1220, 1560), car (1160, 1560). Buildings are `Rect` values inside each block, at least two per block, none overlapping a road.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  SOLARA_LANDMARKS,
  VELA_DISTRICT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collideCircle,
  isOnRoad,
  landmarkAt,
} from './world';

describe('Vela District', () => {
  it('exposes eight original landmarks inside the world bounds', () => {
    expect(SOLARA_LANDMARKS).toHaveLength(8);
    for (const landmark of SOLARA_LANDMARKS) {
      expect(landmark.x).toBeGreaterThan(0);
      expect(landmark.x).toBeLessThan(WORLD_WIDTH);
      expect(landmark.y).toBeGreaterThan(0);
      expect(landmark.y).toBeLessThan(WORLD_HEIGHT);
    }
  });

  it('keeps spawn points on walkable ground', () => {
    expect(isOnRoad(VELA_DISTRICT.spawn.x, VELA_DISTRICT.spawn.y)).toBe(true);
    expect(isOnRoad(VELA_DISTRICT.carSpawn.x, VELA_DISTRICT.carSpawn.y)).toBe(true);
  });

  it('pushes a circle out of a building', () => {
    const building = [{ x: 0, y: 0, width: 100, height: 100 }];
    const resolved = collideCircle(building, 50, 50, 20);
    expect(resolved.hit).toBe(true);
    expect(Math.hypot(resolved.x - 50, resolved.z - 50)).toBeGreaterThan(1);
  });

  it('finds the nearest landmark inside its radius', () => {
    const market = SOLARA_LANDMARKS.find((landmark) => landmark.id === 'tideglass-market')!;
    expect(landmarkAt(market.x + 4, market.y + 4, 60)?.id).toBe('tideglass-market');
    expect(landmarkAt(market.x + 400, market.y + 400, 60)).toBeNull();
  });
});
```

`collideCircle` returns `{ x, z, hit }` (z is the world y coordinate) so it matches the other games' naming.

- [ ] **Step 2–4: RED, implement, GREEN.** Implement `isOnRoad` as "within `ROAD_HALF_WIDTH` of any road line", include sidewalk width 26 in the walkable check, and clamp collision results to the world bounds.
- [ ] **Step 5: Commit** — `git commit -m "feat(neon-coast): model the Vela District world"`

---

### Task 6: Player movement and vehicle physics

**Files:**
- Create: `src/games/neon-coast/player.ts`, `player.test.ts`
- Create: `src/games/neon-coast/vehicle.ts`, `vehicle.test.ts`

**Interfaces:**
- Produces: `interface MoveInput { up: boolean; down: boolean; left: boolean; right: boolean; sprint: boolean; }`
- Produces: `stepPlayer(player: PlayerState, input: MoveInput, dt: number, district: District): PlayerState`
- Produces: `interface DriveInput { forward: boolean; back: boolean; left: boolean; right: boolean; handbrake: boolean; }`
- Produces: `stepVehicle(vehicle: VehicleState, input: DriveInput, dt: number, district: District): VehicleState`

Player: speed 120, sprint 175, acceleration/damping as constants; heading follows the input direction; `collideCircle` against buildings and props; clamp to world.

Vehicle: max 430, acceleration 260, braking 480, reverse 160; steering rate 2.4 rad/s scaled by `min(|speed| / 120, 1)`; handbrake decelerates at 420 and boosts steer ×1.25; collision with buildings reduces speed to 25% and pushes out.

- [ ] **Step 1: Write failing tests**

```ts
it('moves the player toward the pressed direction', () => {
  const start = createPlayer(1220, 1560);
  const next = stepPlayer(start, { up: true, down: false, left: false, right: false, sprint: false }, 1 / 60, VELA_DISTRICT);
  expect(next.x).toBeCloseTo(start.x, 5);
  expect(next.z).toBeLessThan(start.z);
});

it('cannot walk through a building', () => {
  const building = VELA_DISTRICT.blocks.flatMap((block) => block.building);
  const inside = { x: 0, y: 0 };
  const target = building[0]!;
  const next = stepPlayer({ ...createPlayer(inside.x, inside.y), z: target.y + target.height / 2 }, { up: true, down: false, left: false, right: false, sprint: true }, 0.5, VELA_DISTRICT);
  expect(next.z).toBeLessThan(target.y + target.height / 2);
});

it('accelerates, brakes and reverses', () => {
  let car = createVehicle(1160, 1560);
  for (let i = 0; i < 60; i += 1) car = stepVehicle(car, { forward: true, back: false, left: false, right: false, handbrake: false }, 1 / 60, VELA_DISTRICT);
  expect(car.speed).toBeGreaterThan(100);
  const moving = car.speed;
  car = stepVehicle(car, { forward: false, back: true, left: false, right: false, handbrake: false }, 0.2, VELA_DISTRICT);
  expect(car.speed).toBeLessThan(moving);
  car = stepVehicle(car, { forward: false, back: true, left: false, right: false, handbrake: false }, 2, VELA_DISTRICT);
  expect(car.speed).toBeLessThan(0);
});

it('steers only when moving', () => {
  const parked = stepVehicle(createVehicle(1160, 1560), { forward: false, back: false, left: true, right: false, handbrake: false }, 0.5, VELA_DISTRICT);
  expect(parked.heading).toBeCloseTo(createVehicle(1160, 1560).heading, 6);
});
```

- [ ] **Step 2–5: RED, implement, GREEN, commit** — `git commit -m "feat(neon-coast): add on-foot movement and arcade driving"`

---

### Task 7: Traffic and pedestrian state machines

**Files:**
- Create: `src/games/neon-coast/traffic.ts`, `traffic.test.ts`

**Interfaces:**
- Produces: `createTraffic(seed: number): TrafficCar[]`, `stepTraffic(cars, dt, player): TrafficCar[]`
- Produces: `createPedestrians(seed: number): Pedestrian[]`, `stepPedestrians(peds, dt, rng): Pedestrian[]`
- Produces: `type PedestrianMood = 'walking' | 'pausing' | 'turning'`

- [ ] **Step 1: Write failing tests**

```ts
it('creates deterministic traffic from the same seed', () => {
  expect(createTraffic(7)).toEqual(createTraffic(7));
  expect(createTraffic(7)).not.toEqual(createTraffic(8));
});

it('traffic keeps circulating on its route', () => {
  let cars = createTraffic(3);
  const start = cars.map((car) => ({ ...car, position: car.position }));
  for (let i = 0; i < 600; i += 1) cars = stepTraffic(cars, 1 / 60, null);
  expect(cars.some((car) => car.position !== start[0]!.position)).toBe(true);
  for (const car of cars) expect(car.routeIndex).toBeGreaterThanOrEqual(0);
});

it('pedestrians pause, walk and turn deterministically', () => {
  const first = stepPedestrians(createPedestrians(11), 1 / 60, seededRandom(11));
  const second = stepPedestrians(createPedestrians(11), 1 / 60, seededRandom(11));
  expect(first).toEqual(second);
  expect(new Set(first.map((ped) => ped.mood)).size).toBeGreaterThan(1);
});
```

- [ ] **Step 2–5: RED, implement, GREEN, commit** — `git commit -m "feat(neon-coast): add traffic and pedestrian behaviours"`

---

### Task 8: Missions, rewards and progression

**Files:**
- Create: `src/games/neon-coast/missions.ts`, `missions.test.ts`

**Interfaces:**
- Produces: `MISSIONS: MissionDefinition[]`, `type MissionId = 'tideglass-courier' | 'lantern-circuit' | 'landmark-trail' | 'glow-run'`
- Produces: `beginMission(id: MissionId, seed: number): MissionRuntime`
- Produces: `advanceMission(runtime, snapshot): { runtime: MissionRuntime; events: MissionEvent[] }`
- Produces: `rewardFor(id: MissionId, outcome: MissionOutcome): number`
- Produces: `rankFor(completed: readonly MissionId[]): string`

- [ ] **Step 1: Write failing tests** covering:
  - courier requires pickup before delivery;
  - circuit requires a vehicle and ordered gates;
  - landmark trail completes at five discoveries and ignores duplicates;
  - glow run places eight distinct shards from a seed and repeats with a new seed;
  - rewards are exactly 450 / 800 / 600 / (40 per shard + 250 sweep);
  - rank thresholds.
- [ ] **Step 2–5: RED, implement, GREEN, commit** — `git commit -m "feat(neon-coast): add missions, rewards and progression"`

---

### Task 9: Fixed-step simulation and persistence

**Files:**
- Create: `src/games/neon-coast/simulation.ts`, `simulation.test.ts`
- Create: `src/games/neon-coast/persistence.ts`, `persistence.test.ts`

**Interfaces:**
- Produces: `createWorld(seed: number): WorldState`, `stepWorld(state, input, dt): { state: WorldState; events: WorldEvent[] }`
- Produces: `type FrameBudget = { accumulator: number; steps: number }`, `consumeDelta(budget, delta, step?, maxSteps?): FrameBudget`
- Produces: `parseSave(raw: unknown): NeonCoastSave`, `loadSave()`, `saveProgress(save)`, `defaultSave()`, `applyEvent(save, event): NeonCoastSave`

- [ ] **Step 1: Write failing tests**
  - `consumeDelta(0, 0.05)` yields 3 steps at 1/60 and a bounded accumulator; a 2-second stall yields at most 5 steps.
  - Same seed + same scripted input for 600 ticks produces a deep-equal world (JSON snapshot), including traffic and pedestrians.
  - Pausing is the caller's responsibility: `stepWorld` does not run unless called; engine test in Task 11 asserts no ticks while paused.
  - Day/night: `timeOfDay` advances and wraps; at least one expected name (`'day' | 'dusk' | 'night' | 'dawn'`) follows the hour.
  - Enter/exit car changes the controlled entity only when adjacent.
  - Mission acceptance, checkpoint event, delivery, discovery and finish events are emitted once.
  - Save: round-trips; rejects `{ version: 2 }`, malformed JSON, negative cash, unknown mission ids; survives a blocked `localStorage`.
- [ ] **Step 2–5: RED, implement, GREEN, commit** — `git commit -m "feat(neon-coast): add deterministic simulation and versioned saves"`

---

### Task 10: Canvas engine, audio and rendering

**Files:**
- Create: `src/games/neon-coast/engine.ts`, `engine.test.ts` (loop pause/dispose with injected clock)
- Create: `src/games/neon-coast/render.ts`
- Create: `src/games/neon-coast/audio.ts`

**Interfaces:**
- Produces: `class NeonCoastEngine { constructor(canvas, seed, callbacks: { onHud; onEvent }); setInput(patch); start(); pause(); resume(); dispose(); toggleMute(): boolean; get muted(): boolean; }`
- Engine owns RAF, resize observer, DPR cap 2, fixed step `SIM_STEP`, `MAX_STEPS = 5`, HUD at 10 Hz using `HudPump`-equivalent local logic, audio via `GameAudio`-style Web Audio.

- [ ] **Step 1: Write the failing engine lifecycle test** using a fake canvas and a stubbed `requestAnimationFrame`/`cancelAnimationFrame` (jsdom), asserting: start schedules one frame; pause cancels it; resume schedules again; dispose cancels and releases the resize listener; 600 ms of simulated frames advances the world by a bounded number of ticks; no ticks occur while paused.
- [ ] **Step 2–4: RED, implement renderer and audio, GREEN.** The renderer pre-renders the district to an offscreen canvas once, draws water/roads/blocks/props, then dynamic entities, then a day/night tint and a vignette. Reduced motion skips camera shake.
- [ ] **Step 5: Commit** — `git commit -m "feat(neon-coast): add the Canvas 2D engine, renderer and audio"`

---

### Task 11: React shell, tutorial, HUD and controls

**Files:**
- Create: `src/games/neon-coast/NeonCoastGame.tsx`
- Create: `src/games/neon-coast/NeonCoastGame.test.tsx`
- Create: `src/games/neon-coast/controls.tsx` (touch pad + buttons)

- [ ] **Step 1: Write failing shell tests** (jsdom, mocked engine): menu shows the 15-second objective and three mission cards; start calls `onStart`; pause overlay is a labelled dialog; results show reward, best time and rank; restart creates a fresh engine and keeps the muted state; a corrupted save falls back to defaults.
- [ ] **Step 2: Implement the shell.** Menu with district art, mission list with unlock states, best records and the "browser-local" note. In game: HUD (cash, rank, objective, timer, speed, minimap canvas), tutorial coach marks (three steps), prompt pill (`E — drive the Vela`), mission log dialog, pause dialog, results dialog, mute and pause buttons, fullscreen hint. Touch controls: drag joystick on foot, steer/pedal/brake/drift/exit while driving, 44 px minimum. Escape pauses; no page scrolling while the canvas has focus.
- [ ] **Step 3–4: RED, implement, GREEN, commit** — `git commit -m "feat(neon-coast): add the playable shell, tutorial and touch controls"`

---

### Task 12: Integration — types, registry, catalogue, artwork, SEO

**Files:**
- Modify: `src/types/game.ts`, `src/games/registry.ts`, `src/data/games.json`
- Create: `public/art/neon-coast.svg`
- Modify: `e2e/helpers.ts`, `e2e/gameplay.spec.ts`, `e2e/a11y.spec.ts` (automatic through helpers)

- [ ] **Step 1: Add `neon-coast` to `INTERNAL_GAME_KEYS` and the registry** with `lazy(() => import('../games/neon-coast/NeonCoastGame'))`.
- [ ] **Step 2: Add the catalogue record** — title "Neon Coast: After Hours", category `adventure`, secondary `racing` and `casual`, accent `#ffb35c`, honest instructions and controls, `published: true`, `featured: true`, `popularityRank: 39`.
- [ ] **Step 3: Draw an original SVG thumbnail** (coastal night, palms, one car, mint/coral palette) and verify it renders at card size.
- [ ] **Step 4: Add the game to `GAMES` in `e2e/helpers.ts`** and add a gameplay case (start, move, enter car, pause, restart).
- [ ] **Step 5: Verify** — `npm test`, `npm run typecheck`, `npm run build`, `npm run check:bundle`, catalogue integrity tests.
- [ ] **Step 6: Commit** — `git commit -m "feat(neon-coast): register and catalogue the Solara Bay slice"`

---

### Task 13: Browser QA for Neon Coast

**Files:**
- Create: `e2e/neon-coast.spec.ts`

- [ ] **Step 1: Write the spec** covering: launch and first objective visible within 15 s; walk with real keys and the minimap marker moves; drive the Vela (enter with E, accelerate, see speed > 0 and position change); run Tideglass Courier to completion (teleport-free, using a test-only debug hook is forbidden); pause/resume/restart; cash, rank and best time persist after reload; corrupted save recovers; touch controls visible at 390 px; resize and fullscreen; route-away cleanup; no uncaught errors.
- [ ] **Step 2: Run it, fix real failures, re-run.**
- [ ] **Step 3: Manually play Tideglass Courier start-to-finish** in a real browser and record the observation (delivery, reward, unlock, save).
- [ ] **Step 4: Commit** — `git commit -m "test(neon-coast): cover movement, missions, persistence and mobile"`

---

### Task 14: Documentation, verification and push

**Files:**
- Create: `docs/games/neon-coast.md`
- Modify: `README.md`, `docs/audits/2026-11-09-neon-coast-cycle.md`, `docs/research/ROADMAP.md`, `docs/research/ARCHITECTURE.md`, `docs/research/README.md`, `docs/games/1000-game-expansion-program.md`

- [ ] **Step 1: Write the game documentation** — mechanics, controls, missions, persistence, tested behaviour, measured performance, known limits, future districts and features.
- [ ] **Step 2: Update counts and status honestly** — 39 shipped games, 961 planned; mention the three 3D fixes and the new e2e coverage; keep browser-local wording.
- [ ] **Step 3: Run the full gate** — `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundle`, `npm run test:e2e`; record actual output.
- [ ] **Step 4: Measure** — HUD emission rate from the unit test, three.js chunk size from the build, Neon Coast chunk size, and one full-mission timing.
- [ ] **Step 5: Commit and push** — `git push -u origin feat/neon-coast`; verify with `git status` and `git log origin/feat/neon-coast -1`.

## Self-review

- **Spec coverage:** Phase 1 items map to Tasks 1–4; Phase 2/3 modules map to Tasks 5–11; Phase 4 UX to Task 11; Phase 5 originality to Tasks 5–8 and 12; Phase 6 tests to Tasks 5–10 and 13; Phase 7 docs to Task 14.
- **Placeholders:** interfaces and values are fixed in the design spec; no task defers a decision to implementation.
- **Type consistency:** `collideCircle` uses `{ x, z }` everywhere; `HudPump`/`advanceCheckpoint` names are used exactly as produced; `NeonCoastSave` is the single save type in Tasks 9 and 11.
