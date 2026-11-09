/**
 * Deterministic traffic and pedestrian behaviours for Vela District.
 *
 * Both systems are pure: callers pass the previous frame and receive the next
 * frame. Randomness comes from an injected seeded generator.
 */
import { seededRandom } from './random';
import {
  type Point,
  type Rect,
  ROAD_HORIZONTAL,
  ROAD_VERTICAL,
  VELA_DISTRICT,
} from './world';

export interface TrafficCar {
  id: number;
  position: Point;
  heading: number;
  speed: number;
  routeIndex: number;
  waypoints: Point[];
}

const TRAFFIC_MIN_SPEED = 80;
const TRAFFIC_MAX_SPEED = 140;
const TRAFFIC_BRAKE_DISTANCE = 150;
const TRAFFIC_BRAKE_FACTOR = 0.35;

/** Six rectangular circuits around neighbouring blocks. */
const TRAFFIC_LOOPS: Rect[] = [
  { x: ROAD_VERTICAL[0]!, y: ROAD_HORIZONTAL[0]!, width: ROAD_VERTICAL[1]! - ROAD_VERTICAL[0]!, height: ROAD_HORIZONTAL[1]! - ROAD_HORIZONTAL[0]! },
  { x: ROAD_VERTICAL[1]!, y: ROAD_HORIZONTAL[0]!, width: ROAD_VERTICAL[2]! - ROAD_VERTICAL[1]!, height: ROAD_HORIZONTAL[1]! - ROAD_HORIZONTAL[0]! },
  { x: ROAD_VERTICAL[2]!, y: ROAD_HORIZONTAL[0]!, width: ROAD_VERTICAL[3]! - ROAD_VERTICAL[2]!, height: ROAD_HORIZONTAL[1]! - ROAD_HORIZONTAL[0]! },
  { x: ROAD_VERTICAL[0]!, y: ROAD_HORIZONTAL[2]!, width: ROAD_VERTICAL[1]! - ROAD_VERTICAL[0]!, height: ROAD_HORIZONTAL[3]! - ROAD_HORIZONTAL[2]! },
  { x: ROAD_VERTICAL[1]!, y: ROAD_HORIZONTAL[2]!, width: ROAD_VERTICAL[2]! - ROAD_VERTICAL[1]!, height: ROAD_HORIZONTAL[3]! - ROAD_HORIZONTAL[2]! },
  { x: ROAD_VERTICAL[2]!, y: ROAD_HORIZONTAL[2]!, width: ROAD_VERTICAL[3]! - ROAD_VERTICAL[2]!, height: ROAD_HORIZONTAL[3]! - ROAD_HORIZONTAL[2]! },
];

function loopWaypoints(box: Rect): Point[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

function headingToward(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, -(to.y - from.y));
}

export function createTraffic(seed: number): TrafficCar[] {
  const rng = seededRandom(seed);
  return TRAFFIC_LOOPS.map((box, index) => {
    const waypoints = loopWaypoints(box);
    const start = waypoints[0]!;
    const next = waypoints[1]!;
    const t = 0.1 + rng() * 0.8;
    const position = {
      x: start.x + (next.x - start.x) * t,
      y: start.y + (next.y - start.y) * t,
    };
    return {
      id: index,
      position,
      heading: headingToward(position, next),
      speed: TRAFFIC_MIN_SPEED + rng() * (TRAFFIC_MAX_SPEED - TRAFFIC_MIN_SPEED),
      routeIndex: 1,
      waypoints,
    };
  });
}

function aheadOf(car: TrafficCar, point: Point): boolean {
  const dx = point.x - car.position.x;
  const dy = point.y - car.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance > TRAFFIC_BRAKE_DISTANCE) return false;
  const forwardX = Math.sin(car.heading);
  const forwardY = -Math.cos(car.heading);
  return (dx * forwardX + dy * forwardY) / Math.max(distance, 1) > 0.4;
}

export function stepTraffic(
  cars: ReadonlyArray<TrafficCar>,
  dt: number,
  player: Point | null,
): TrafficCar[] {
  return cars.map((car) => {
    const target = car.waypoints[car.routeIndex] ?? car.waypoints[0]!;
    const dx = target.x - car.position.x;
    const dy = target.y - car.position.y;
    const distance = Math.hypot(dx, dy);

    let x = car.position.x;
    let y = car.position.y;
    let routeIndex = car.routeIndex;
    const heading = distance > 1e-3 ? headingToward(car.position, target) : car.heading;

    const speed = player && aheadOf(car, player) ? car.speed * TRAFFIC_BRAKE_FACTOR : car.speed;
    const travel = speed * dt;
    if (travel >= distance) {
      x = target.x;
      y = target.y;
      routeIndex = (routeIndex + 1) % car.waypoints.length;
    } else {
      x += (dx / distance) * travel;
      y += (dy / distance) * travel;
    }

    return { ...car, position: { x, y }, heading, routeIndex };
  });
}

export type PedestrianMood = 'walking' | 'pausing' | 'turning';

export interface Pedestrian {
  id: number;
  position: Point;
  heading: number;
  mood: PedestrianMood;
  timer: number;
  speed: number;
  routeIndex: number;
  waypoints: Point[];
}

const PEDESTRIAN_INSET = 84;
const PEDESTRIAN_MIN_SPEED = 30;
const PEDESTRIAN_MAX_SPEED = 52;
const PEDESTRIAN_TURN_RATE = 6;

function sidewalkLoop(bounds: Rect): Point[] {
  const left = bounds.x - (100 - PEDESTRIAN_INSET);
  const right = bounds.x + bounds.width + (100 - PEDESTRIAN_INSET);
  const top = bounds.y - (100 - PEDESTRIAN_INSET);
  const bottom = bounds.y + bounds.height + (100 - PEDESTRIAN_INSET);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function createPedestrians(seed: number): Pedestrian[] {
  const rng = seededRandom(seed);
  return VELA_DISTRICT.blocks.map((block, index) => {
    const waypoints = sidewalkLoop(block.bounds);
    const start = waypoints[0]!;
    const next = waypoints[1]!;
    const t = rng();
    const position = {
      x: start.x + (next.x - start.x) * t,
      y: start.y + (next.y - start.y) * t,
    };
    return {
      id: index,
      position,
      heading: headingToward(position, next),
      mood: index % 3 === 2 ? 'pausing' : 'walking',
      timer: 0.6 + rng() * 2.4,
      speed: PEDESTRIAN_MIN_SPEED + rng() * (PEDESTRIAN_MAX_SPEED - PEDESTRIAN_MIN_SPEED),
      routeIndex: 1,
      waypoints,
    };
  });
}

function turnToward(current: number, target: number, maxStep: number): number {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

export function stepPedestrians(
  pedestrians: ReadonlyArray<Pedestrian>,
  dt: number,
  rng: () => number,
): Pedestrian[] {
  return pedestrians.map((ped) => {
    let { mood, timer, heading, routeIndex, position } = ped;

    if (mood === 'pausing') {
      timer -= dt;
      if (timer <= 0) {
        mood = 'walking';
        timer = 2 + rng() * 3;
      }
      return { ...ped, mood, timer };
    }

    if (mood === 'turning') {
      timer -= dt;
      const target = ped.waypoints[routeIndex] ?? ped.waypoints[0]!;
      heading = turnToward(heading, headingToward(position, target), PEDESTRIAN_TURN_RATE * dt);
      if (timer <= 0) {
        mood = 'walking';
        timer = 1.5 + rng() * 2;
      }
      return { ...ped, mood, timer, heading };
    }

    timer -= dt;
    if (timer <= 0) {
      return { ...ped, mood: 'pausing', timer: 0.8 + rng() * 1.8 };
    }

    const target = ped.waypoints[routeIndex] ?? ped.waypoints[0]!;
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const distance = Math.hypot(dx, dy);
    heading = distance > 1e-3 ? headingToward(position, target) : heading;
    const travel = ped.speed * dt;

    if (travel >= distance) {
      position = { x: target.x, y: target.y };
      routeIndex = (routeIndex + 1) % ped.waypoints.length;
      mood = 'turning';
      timer = 0.35;
    } else {
      position = {
        x: position.x + (dx / distance) * travel,
        y: position.y + (dy / distance) * travel,
      };
    }

    return { ...ped, mood, timer, heading, routeIndex, position };
  });
}
