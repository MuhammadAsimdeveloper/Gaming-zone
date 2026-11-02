import * as THREE from 'three';

export const DRIVE_EXTENT = 96;
export const ROAD_HALF_WIDTH = 6;
export const ROAD_LINES = [-72, -36, 0, 36, 72];
export const BLOCK_SPAN = 36;

export interface DrivePoint {
  x: number;
  z: number;
}

export interface DriveMission {
  id: string;
  name: string;
  brief: string;
  timeLimit: number;
  route: DrivePoint[];
}

export type DriveCarId = 'nova-gt' | 'vanta-rs' | 'halo-s';

export interface DriveCar {
  id: DriveCarId;
  name: string;
  tagline: string;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  reverseSpeed: number;
  color: string;
  accent: string;
}

export type DriveCameraMode = 'chase' | 'far' | 'hood';

export const DRIVE_CARS: DriveCar[] = [
  {
    id: 'nova-gt',
    name: 'Nova GT',
    tagline: 'Balanced street coupe',
    maxSpeed: 27,
    acceleration: 13,
    handling: 2,
    reverseSpeed: 8,
    color: '#4c8dff',
    accent: '#38e8ff',
  },
  {
    id: 'vanta-rs',
    name: 'Vanta RS',
    tagline: 'Top speed, heavier turn-in',
    maxSpeed: 31,
    acceleration: 12,
    handling: 1.72,
    reverseSpeed: 8,
    color: '#a06bff',
    accent: '#c8a5ff',
  },
  {
    id: 'halo-s',
    name: 'Halo S',
    tagline: 'Quick off the line, nimble',
    maxSpeed: 24,
    acceleration: 15.5,
    handling: 2.2,
    reverseSpeed: 9,
    color: '#38e8ff',
    accent: '#9ff7ff',
  },
];

export function getDriveCar(id: DriveCarId): DriveCar {
  return DRIVE_CARS.find((car) => car.id === id) ?? DRIVE_CARS[0]!;
}

function point(lineIndexX: number, lineIndexZ: number): DrivePoint {
  return { x: ROAD_LINES[lineIndexX] ?? 0, z: ROAD_LINES[lineIndexZ] ?? 0 };
}

export const DRIVE_MISSIONS: DriveMission[] = [
  {
    id: 'first-light',
    name: 'First Light',
    brief: 'Learn the grid: five checkpoint gates through the morning streets.',
    timeLimit: 85,
    route: [point(2, 4), point(4, 2), point(3, 0), point(1, 1), point(0, 2)],
  },
  {
    id: 'neon-courier',
    name: 'Neon Courier',
    brief: 'A cross-town delivery just as the lights come on.',
    timeLimit: 90,
    route: [point(0, 4), point(0, 2), point(1, 0), point(3, 1), point(4, 3)],
  },
  {
    id: 'grid-lock',
    name: 'Grid Lock',
    brief: 'Six gates and a tighter clock. Sweep the outer blocks.',
    timeLimit: 105,
    route: [point(4, 4), point(4, 0), point(3, 0), point(1, 0), point(0, 2), point(0, 4)],
  },
  {
    id: 'midnight-run',
    name: 'Midnight Run',
    brief: 'The full perimeter at nightfall. Traffic is heavier and the clock is unforgiving.',
    timeLimit: 115,
    route: [point(0, 0), point(4, 0), point(4, 4), point(0, 4), point(0, 2), point(2, 2)],
  },
];

export function getDriveMission(id: string): DriveMission {
  return DRIVE_MISSIONS.find((mission) => mission.id === id) ?? DRIVE_MISSIONS[0]!;
}

export interface DriveRecord {
  runs: number;
  completed: string[];
  bestTimes: Record<string, number>;
}

const RECORD_KEY = 'neonrift:game:neon-city-drive:record';

export function loadDriveRecord(): DriveRecord {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    if (!raw) return { runs: 0, completed: [], bestTimes: {} };
    const parsed = JSON.parse(raw) as Partial<DriveRecord>;
    return {
      runs: Number.isFinite(parsed.runs) ? Number(parsed.runs) : 0,
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((id) => typeof id === 'string') : [],
      bestTimes:
        parsed.bestTimes && typeof parsed.bestTimes === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.bestTimes).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
            )
          : {},
    };
  } catch {
    return { runs: 0, completed: [], bestTimes: {} };
  }
}

export function saveDriveRecord(record: DriveRecord): void {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // Storage can be blocked; the run still completes.
  }
}

export interface CityCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const CELL_CENTERS = [-54, -18, 18, 54];
const PARK_CELLS = new Set(['0:1', '1:3', '2:2', '3:0']);

export interface CityEnvironment {
  group: THREE.Group;
  colliders: CityCollider[];
  stars: THREE.Points;
}

export function createCityEnvironment(): CityEnvironment {
  const group = new THREE.Group();
  const colliders: CityCollider[] = [];
  const random = seededRandom(2048);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: '#070d18', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#141a2b', roughness: 0.86, metalness: 0.14 });
  const roadGeometry = new THREE.PlaneGeometry(208, ROAD_HALF_WIDTH * 2);

  for (const line of ROAD_LINES) {
    const horizontal = new THREE.Mesh(roadGeometry, roadMaterial);
    horizontal.rotation.x = -Math.PI / 2;
    horizontal.position.set(0, 0.02, line);
    horizontal.receiveShadow = true;
    group.add(horizontal);

    const vertical = new THREE.Mesh(roadGeometry, roadMaterial);
    vertical.rotation.x = -Math.PI / 2;
    vertical.rotation.z = Math.PI / 2;
    vertical.position.set(line, 0.02, 0);
    vertical.receiveShadow = true;
    group.add(vertical);
  }

  const sidewalkGeometry = new THREE.BoxGeometry(1, 0.16, 1);
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: '#1b2438', roughness: 0.9 });
  const sidewalkCells = CELL_CENTERS.length ** 2;
  const sidewalks = new THREE.InstancedMesh(sidewalkGeometry, sidewalkMaterial, sidewalkCells);
  sidewalks.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let sidewalkIndex = 0;
  for (const cellX of CELL_CENTERS) {
    for (const cellZ of CELL_CENTERS) {
      dummy.position.set(cellX, 0.08, cellZ);
      dummy.scale.set(BLOCK_SPAN - ROAD_HALF_WIDTH * 2 + 1.4, 1, BLOCK_SPAN - ROAD_HALF_WIDTH * 2 + 1.4);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      sidewalks.setMatrixAt(sidewalkIndex, dummy.matrix);
      sidewalkIndex += 1;
    }
  }
  group.add(sidewalks);

  const dashGeometry = new THREE.BoxGeometry(2.4, 0.03, 0.24);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: '#93a1bd', transparent: true, opacity: 0.35 });
  const dashCount = ROAD_LINES.length * 2 * 14;
  const dashes = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashCount);
  let dashIndex = 0;
  for (const line of ROAD_LINES) {
    for (let i = 0; i < 14; i += 1) {
      const offset = -88 + i * 13;
      dummy.position.set(offset, 0.05, line);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      if (dashIndex < dashCount) dashes.setMatrixAt(dashIndex, dummy.matrix);
      dashIndex += 1;

      dummy.position.set(line, 0.05, offset);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      if (dashIndex < dashCount) dashes.setMatrixAt(dashIndex, dummy.matrix);
      dashIndex += 1;
    }
  }
  dashes.count = dashIndex;
  group.add(dashes);

  const crossingGeometry = new THREE.BoxGeometry(1.1, 0.035, 4.2);
  const crossingMaterial = new THREE.MeshBasicMaterial({ color: '#e7efff', transparent: true, opacity: 0.4 });
  const crossings = new THREE.InstancedMesh(
    crossingGeometry,
    crossingMaterial,
    ROAD_LINES.length * ROAD_LINES.length * 24,
  );
  let crossingIndex = 0;
  for (const lineX of ROAD_LINES) {
    for (const lineZ of ROAD_LINES) {
      for (const side of [-1, 1]) {
        for (let stripe = 0; stripe < 2; stripe += 1) {
          for (const offset of [-2.4, 0, 2.4]) {
            if (crossingIndex >= crossings.count) break;
            dummy.position.set(
              lineX + offset + side * (ROAD_HALF_WIDTH + 2.2),
              0.045,
              lineZ + stripe * 3.4 - 1.7,
            );
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            crossings.setMatrixAt(crossingIndex, dummy.matrix);
            crossingIndex += 1;
          }
          for (const offset of [-2.4, 0, 2.4]) {
            if (crossingIndex >= crossings.count) break;
            dummy.position.set(
              lineX + stripe * 3.4 - 1.7,
              0.045,
              lineZ + offset + side * (ROAD_HALF_WIDTH + 2.2),
            );
            dummy.rotation.set(0, Math.PI / 2, 0);
            dummy.updateMatrix();
            crossings.setMatrixAt(crossingIndex, dummy.matrix);
            crossingIndex += 1;
          }
        }
      }
    }
  }
  crossings.count = crossingIndex;
  group.add(crossings);

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72, metalness: 0.24 });
  const buildingCount = 64;
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildingCount);
  buildings.castShadow = true;
  buildings.receiveShadow = true;

  const stripGeometry = new THREE.BoxGeometry(1, 1, 1);
  const stripMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const strips = new THREE.InstancedMesh(stripGeometry, stripMaterial, buildingCount * 2);
  const stripColors = [new THREE.Color('#4c8dff'), new THREE.Color('#a06bff'), new THREE.Color('#38e8ff'), new THREE.Color('#ff6b81')];
  const buildingColor = new THREE.Color();

  const treeTrunkGeometry = new THREE.CylinderGeometry(0.2, 0.28, 2.4, 6);
  const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 1 });
  const treeCrownGeometry = new THREE.ConeGeometry(1.9, 4.4, 7);
  const treeCrownMaterial = new THREE.MeshStandardMaterial({ color: '#14503a', roughness: 0.85 });
  const treeCount = 4 * 9;
  const trunks = new THREE.InstancedMesh(treeTrunkGeometry, treeTrunkMaterial, treeCount);
  const crowns = new THREE.InstancedMesh(treeCrownGeometry, treeCrownMaterial, treeCount);

  let buildingIndex = 0;
  let stripIndex = 0;
  let treeIndex = 0;

  CELL_CENTERS.forEach((cellX, ix) => {
    CELL_CENTERS.forEach((cellZ, iz) => {
      const key = `${ix}:${iz}`;
      if (PARK_CELLS.has(key)) {
        const park = new THREE.Mesh(
          new THREE.PlaneGeometry(21, 21),
          new THREE.MeshStandardMaterial({ color: '#0c2a23', roughness: 1 }),
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(cellX, 0.17, cellZ);
        park.receiveShadow = true;
        group.add(park);

        for (let tree = 0; tree < 9; tree += 1) {
          const angle = random() * Math.PI * 2;
          const radius = 2.5 + random() * 7;
          const x = cellX + Math.cos(angle) * radius;
          const z = cellZ + Math.sin(angle) * radius;
          dummy.position.set(x, 1.35, z);
          dummy.rotation.set(0, random() * Math.PI, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          trunks.setMatrixAt(treeIndex, dummy.matrix);
          dummy.position.set(x, 3.8, z);
          dummy.scale.set(1, 0.85 + random() * 0.5, 1);
          dummy.updateMatrix();
          crowns.setMatrixAt(treeIndex, dummy.matrix);
          treeIndex += 1;
        }
        return;
      }

      for (let building = 0; building < 4; building += 1) {
        const width = 5.5 + random() * 4.5;
        const depth = 5.5 + random() * 4.5;
        const height = 8 + random() * 34;
        const offsetX = (building % 2 === 0 ? -1 : 1) * (4.5 + random() * 1.5);
        const offsetZ = (building < 2 ? -1 : 1) * (4.5 + random() * 1.5);
        const x = cellX + offsetX;
        const z = cellZ + offsetZ;

        dummy.position.set(x, height / 2 + 0.16, z);
        dummy.scale.set(width, height, depth);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        buildings.setMatrixAt(buildingIndex, dummy.matrix);
        buildingColor.setHSL(0.6 + random() * 0.08, 0.22, 0.07 + random() * 0.05);
        buildings.setColorAt(buildingIndex, buildingColor);

        for (const ratio of [0.35, 0.72]) {
          const color = stripColors[stripIndex % stripColors.length]!;
          const stripHeight = height * ratio + 0.16;
          dummy.position.set(x, stripHeight, z);
          dummy.scale.set(width * 1.005, 0.22, depth * 1.005);
          dummy.updateMatrix();
          if (stripIndex < strips.count) strips.setMatrixAt(stripIndex, dummy.matrix);
          if (stripIndex < strips.count) strips.setColorAt(stripIndex, color);
          stripIndex += 1;
        }

        colliders.push({
          minX: x - width / 2 - 0.4,
          maxX: x + width / 2 + 0.4,
          minZ: z - depth / 2 - 0.4,
          maxZ: z + depth / 2 + 0.4,
        });
        buildingIndex += 1;
      }
    });
  });

  buildings.count = buildingIndex;
  strips.count = stripIndex;
  buildings.instanceColor!.needsUpdate = true;
  strips.instanceColor!.needsUpdate = true;
  buildings.instanceMatrix.needsUpdate = true;
  strips.instanceMatrix.needsUpdate = true;
  trunks.count = treeIndex;
  crowns.count = treeIndex;
  group.add(buildings, strips, trunks, crowns);

  const poleGeometry = new THREE.CylinderGeometry(0.11, 0.15, 6.4, 6);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#1a2236', metalness: 0.6, roughness: 0.4 });
  const bulbGeometry = new THREE.SphereGeometry(0.24, 8, 8);
  const bulbMaterial = new THREE.MeshBasicMaterial({ color: '#bfe7ff' });
  const lampCount = ROAD_LINES.length * 2 * 8;
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, lampCount);
  const bulbs = new THREE.InstancedMesh(bulbGeometry, bulbMaterial, lampCount);
  let lampIndex = 0;
  for (const line of ROAD_LINES) {
    for (let i = 0; i < 8; i += 1) {
      const offset = -80 + i * 23;
      for (const axis of ['x', 'z'] as const) {
        if (lampIndex >= lampCount) break;
        const side = (i + lampIndex) % 2 === 0 ? 1 : -1;
        const x = axis === 'x' ? offset : line + side * 7.4;
        const z = axis === 'x' ? line + side * 7.4 : offset;
        dummy.position.set(x, 3.2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        poles.setMatrixAt(lampIndex, dummy.matrix);
        dummy.position.set(x, 6.45, z);
        dummy.updateMatrix();
        bulbs.setMatrixAt(lampIndex, dummy.matrix);
        lampIndex += 1;
      }
    }
  }
  poles.count = lampIndex;
  bulbs.count = lampIndex;
  group.add(poles, bulbs);

  const starsGeometry = new THREE.BufferGeometry();
  const starPositions: number[] = [];
  for (let i = 0; i < 500; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 120 + random() * 220;
    starPositions.push(Math.cos(angle) * radius, 45 + random() * 110, Math.sin(angle) * radius);
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({ color: '#c6d8ff', size: 0.8, transparent: true, opacity: 0.85 }),
  );
  group.add(stars);

  return { group, colliders, stars };
}

export interface TrafficSpawn {
  axis: 'x' | 'z';
  lane: number;
  direction: 1 | -1;
  position: number;
  speed: number;
  color: string;
  accent: string;
}

export function createTrafficSpawns(): TrafficSpawn[] {
  const colors = ['#ff8fab', '#9c7bff', '#5eead4', '#ffd166', '#7dd3fc', '#f472b6'];
  const spawns: TrafficSpawn[] = [];
  const lanes = [
    { line: -72, offset: 3.1 },
    { line: -36, offset: -3.1 },
    { line: 0, offset: 3.1 },
    { line: 36, offset: -3.1 },
    { line: 72, offset: 3.1 },
  ];

  lanes.forEach((lane, index) => {
    spawns.push({
      axis: 'x',
      lane: lane.line + lane.offset,
      direction: index % 2 === 0 ? 1 : -1,
      position: -80 + index * 33,
      speed: 8.5 + (index % 3) * 1.6,
      color: colors[index % colors.length]!,
      accent: colors[(index + 1) % colors.length]!,
    });
    spawns.push({
      axis: 'z',
      lane: lane.line + lane.offset,
      direction: index % 2 === 0 ? -1 : 1,
      position: 70 - index * 31,
      speed: 8 + (index % 2) * 2.1,
      color: colors[(index + 3) % colors.length]!,
      accent: colors[index % colors.length]!,
    });
  });

  return spawns;
}
