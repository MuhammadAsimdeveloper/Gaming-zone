/**
 * Fixed-step world simulation for Neon Coast. Pure state in, state out.
 *
 * The engine owns the clock: it feeds fixed SIM_STEP deltas through
 * consumeDelta and calls stepWorld once per consumed step. This module never
 * schedules frames and never touches the DOM.
 */
import {
  advanceMission,
  beginMission,
  definitionFor,
  rewardFor,
  type MissionId,
  type MissionRuntime,
} from './missions';
import { PLAYER_RADIUS, createPlayer, stepPlayer, type MoveInput, type PlayerState } from './player';
import { seededRandom } from './random';
import { createPedestrians, createTraffic, stepPedestrians, stepTraffic } from './traffic';
import type { Pedestrian, TrafficCar } from './traffic';
import {
  VELA_DISTRICT,
  collideCircle,
  landmarkAt,
  obstacleRects,
  type Point,
} from './world';
import {
  VEHICLE_RADIUS,
  createVehicle,
  stepVehicle,
  type DriveInput,
  type VehicleState,
} from './vehicle';

export const SIM_STEP = 1 / 60;
export const MAX_STEPS = 5;
export const DAY_LENGTH_SECONDS = 300;
export const CAR_ENTER_RADIUS = 110;
const LANDMARK_REACH = 95;

export interface FrameBudget {
  accumulator: number;
  steps: number;
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface WorldInput {
  move: MoveInput;
  drive: DriveInput;
  interact: boolean;
  acceptMission?: MissionId | null;
}

export type WorldEvent =
  | { type: 'mission-accepted'; id: MissionId; name: string }
  | { type: 'checkpoint'; id: string }
  | { type: 'discover'; id: string }
  | { type: 'shard'; index: number }
  | { type: 'mission-complete'; id: MissionId; reward: number; elapsed: number; shards: number }
  | { type: 'mission-failed'; id: MissionId; reward: number; elapsed: number; shards: number }
  | { type: 'enter-car' }
  | { type: 'exit-car' };

export interface WorldState {
  seed: number;
  tick: number;
  timeOfDay: number;
  player: PlayerState;
  vehicle: VehicleState;
  inVehicle: boolean;
  traffic: TrafficCar[];
  pedestrians: Pedestrian[];
  mission: MissionRuntime | null;
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

export function dayPhase(timeOfDay: number): DayPhase {
  const clock = wrap01(timeOfDay);
  if (clock >= 0.2 && clock < 0.3) return 'dawn';
  if (clock >= 0.3 && clock < 0.65) return 'day';
  if (clock >= 0.65 && clock < 0.78) return 'dusk';
  return 'night';
}

export function consumeDelta(
  budget: FrameBudget,
  delta: number,
  step: number = SIM_STEP,
  maxSteps: number = MAX_STEPS,
): FrameBudget {
  const clamped = Math.min(Math.max(delta, 0), step * maxSteps);
  let accumulator = budget.accumulator + clamped;
  let steps = 0;
  while (accumulator + 1e-9 >= step && steps < maxSteps) {
    accumulator -= step;
    steps += 1;
  }
  return { accumulator: Math.max(0, accumulator), steps };
}

export function createWorld(seed: number): WorldState {
  return {
    seed,
    tick: 0,
    timeOfDay: 0.36,
    player: createPlayer(VELA_DISTRICT.spawn.x, VELA_DISTRICT.spawn.y),
    vehicle: createVehicle(VELA_DISTRICT.carSpawn.x, VELA_DISTRICT.carSpawn.y),
    inVehicle: false,
    traffic: createTraffic(seed),
    pedestrians: createPedestrians(seed),
    mission: null,
  };
}

function exitPosition(vehicle: VehicleState): Point {
  const side = vehicle.heading + Math.PI / 2;
  const offset = VEHICLE_RADIUS + PLAYER_RADIUS + 10;
  const resolved = collideCircle(
    obstacleRects(VELA_DISTRICT),
    vehicle.x + Math.cos(side) * offset,
    vehicle.z + Math.sin(side) * offset,
    PLAYER_RADIUS,
  );
  return { x: resolved.x, y: resolved.z };
}

function missionEvents(
  runtime: MissionRuntime,
  events: WorldEvent[],
  emitted: ReturnType<typeof advanceMission>['events'],
): void {
  for (const event of emitted) {
    if (event.type === 'complete') {
      const shards = runtime.collected.length;
      events.push({
        type: 'mission-complete',
        id: runtime.id,
        reward: rewardFor(runtime.id, { completed: true, shards }),
        elapsed: runtime.elapsed,
        shards,
      });
    } else if (event.type === 'failed') {
      const shards = runtime.collected.length;
      events.push({
        type: 'mission-failed',
        id: runtime.id,
        reward: rewardFor(runtime.id, { completed: false, shards }),
        elapsed: runtime.elapsed,
        shards,
      });
    } else {
      events.push(event);
    }
  }
}

export function stepWorld(
  state: WorldState,
  input: WorldInput,
  dt: number,
): { state: WorldState; events: WorldEvent[] } {
  const events: WorldEvent[] = [];
  let { inVehicle, player, vehicle } = state;

  if (input.interact) {
    if (inVehicle) {
      const exit = exitPosition(vehicle);
      inVehicle = false;
      player = { ...createPlayer(exit.x, exit.y), heading: vehicle.heading };
      events.push({ type: 'exit-car' });
    } else if (Math.hypot(player.x - vehicle.x, player.z - vehicle.z) <= CAR_ENTER_RADIUS) {
      inVehicle = true;
      player = {
        ...player,
        x: vehicle.x,
        z: vehicle.z,
        heading: vehicle.heading,
        speed: 0,
        vx: 0,
        vz: 0,
      };
      events.push({ type: 'enter-car' });
    }
  }

  if (inVehicle) {
    vehicle = stepVehicle(vehicle, input.drive, dt, VELA_DISTRICT);
    player = {
      ...player,
      x: vehicle.x,
      z: vehicle.z,
      heading: vehicle.heading,
      speed: vehicle.speed,
      vx: Math.sin(vehicle.heading) * vehicle.speed,
      vz: -Math.cos(vehicle.heading) * vehicle.speed,
    };
  } else {
    player = stepPlayer(player, input.move, dt, VELA_DISTRICT);
  }

  const tick = state.tick + 1;
  const timeOfDay = wrap01(state.timeOfDay + dt / DAY_LENGTH_SECONDS);
  const traffic = stepTraffic(state.traffic, dt, { x: player.x, y: player.z });
  const pedestrians = stepPedestrians(
    state.pedestrians,
    dt,
    seededRandom(state.seed * 131 + tick),
  );

  let mission = state.mission;
  if (input.acceptMission && (!mission || mission.status !== 'active')) {
    mission = beginMission(input.acceptMission, state.seed + tick);
    events.push({
      type: 'mission-accepted',
      id: mission.id,
      name: definitionFor(mission.id).name,
    });
  }

  if (mission && mission.status === 'active') {
    const position = inVehicle
      ? { x: vehicle.x, y: vehicle.z }
      : { x: player.x, y: player.z };
    const landmark = landmarkAt(position.x, position.y, LANDMARK_REACH);
    const advanced = advanceMission(mission, {
      dt,
      position,
      inVehicle,
      landmarkId: landmark ? landmark.id : null,
    });
    mission = advanced.runtime;
    missionEvents(mission, events, advanced.events);
  }

  return {
    state: {
      seed: state.seed,
      tick,
      timeOfDay,
      player,
      vehicle,
      inVehicle,
      traffic,
      pedestrians,
      mission,
    },
    events,
  };
}
