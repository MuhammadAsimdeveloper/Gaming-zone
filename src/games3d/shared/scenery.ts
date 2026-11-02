import * as THREE from 'three';

export interface TrackPoint {
  x: number;
  z: number;
}

export interface VehicleVisual {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  underglow: THREE.Mesh;
}

export function createCar(color: string, accent: string): VehicleVisual {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.32,
    envMapIntensity: 0.8,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: '#0b1020', metalness: 0.6, roughness: 0.4 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#0a1730',
    metalness: 0.9,
    roughness: 0.12,
    emissive: '#12315c',
    emissiveIntensity: 0.4,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.46, 4.3), bodyMaterial);
  body.position.y = 0.52;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.26, 1.05), bodyMaterial);
  nose.position.set(0, 0.36, -2.22);
  nose.castShadow = true;
  group.add(nose);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.5, 1.9), glassMaterial);
  cabin.position.set(0, 0.95, -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.7), bodyMaterial);
  roof.position.set(0, 1.2, -0.1);
  group.add(roof);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.42), darkMaterial);
  spoiler.position.set(0, 1.08, 1.95);
  group.add(spoiler);

  for (const x of [-0.72, 0.72]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), darkMaterial);
    support.position.set(x, 0.94, 1.95);
    group.add(support);
  }

  const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 18);
  const rimGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 12);
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: '#cbd5f5',
    metalness: 0.9,
    roughness: 0.2,
    emissive: accent,
    emissiveIntensity: 0.55,
  });

  const wheels: THREE.Object3D[] = [];
  for (const x of [-1.02, 1.02]) {
    for (const z of [-1.42, 1.48]) {
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(wheelGeometry, darkMaterial);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      wheel.add(tyre);
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
      wheel.position.set(x, 0.38, z);
      wheels.push(wheel);
      group.add(wheel);
    }
  }

  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: '#eaf2ff',
    emissive: '#dcecff',
    emissiveIntensity: 2.4,
  });
  for (const x of [-0.62, 0.62]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), headlightMaterial);
    light.position.set(x, 0.5, -2.73);
    group.add(light);
  }

  const tailMaterial = new THREE.MeshStandardMaterial({
    color: '#ff4d6d',
    emissive: '#ff2e55',
    emissiveIntensity: 2,
  });
  for (const x of [-0.62, 0.62]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.06), tailMaterial);
    tail.position.set(x, 0.56, 2.16);
    group.add(tail);
  }

  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 4.7),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.035;
  group.add(underglow);

  return { group, wheels, underglow };
}

export function createRoad(
  points: TrackPoint[],
  width: number,
  curbColors: [string, string],
): { group: THREE.Group; length: number } {
  const group = new THREE.Group();
  const count = points.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];

  const edgeColors = [new THREE.Color(curbColors[0]), new THREE.Color(curbColors[1])];
  const curbPositions: number[] = [];
  const curbIndices: number[] = [];
  const curbVertexColors: number[] = [];

  let length = 0;

  for (let i = 0; i < count; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % count]!;
    const previous = points[(i - 1 + count) % count]!;
    const tx = next.x - previous.x;
    const tz = next.z - previous.z;
    const magnitude = Math.hypot(tx, tz) || 1;
    const nx = -tz / magnitude;
    const nz = tx / magnitude;
    length += Math.hypot(next.x - current.x, next.z - current.z);

    const half = width / 2;
    positions.push(
      current.x + nx * half,
      0.02,
      current.z + nz * half,
      current.x - nx * half,
      0.02,
      current.z - nz * half,
    );

    if (i < count) {
      const a = i * 2;
      const b = ((i + 1) % count) * 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }

    const curbWidth = 1.1;
    const curbColor = edgeColors[i % 2]!;
    curbPositions.push(
      current.x + nx * half,
      0.05,
      current.z + nz * half,
      current.x + nx * (half + curbWidth),
      0.05,
      current.z + nz * (half + curbWidth),
      current.x - nx * half,
      0.05,
      current.z - nz * half,
      current.x - nx * (half + curbWidth),
      0.05,
      current.z - nz * (half + curbWidth),
    );
    for (let k = 0; k < 4; k += 1) {
      curbVertexColors.push(curbColor.r, curbColor.g, curbColor.b);
    }
  }

  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    const a = i * 4;
    const b = next * 4;
    curbIndices.push(a, b, a + 1, b, b + 1, a + 1);
    curbIndices.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const road = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: '#11162a', roughness: 0.82, metalness: 0.18 }),
  );
  road.receiveShadow = true;
  group.add(road);

  const curbGeometry = new THREE.BufferGeometry();
  curbGeometry.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
  curbGeometry.setAttribute('color', new THREE.Float32BufferAttribute(curbVertexColors, 3));
  curbGeometry.setIndex(curbIndices);
  const curbs = new THREE.Mesh(
    curbGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  group.add(curbs);

  const linePositions: number[] = [];
  for (let i = 0; i < count; i += 2) {
    const a = points[i]!;
    const b = points[(i + 1) % count]!;
    linePositions.push(a.x, 0.06, a.z, b.x, 0.06, b.z);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const centerLine = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: '#8fa6cc', transparent: true, opacity: 0.3 }),
  );
  group.add(centerLine);

  void colors;
  return { group, length };
}

export function createStartGate(point: TrackPoint, heading: number, accent: string): THREE.Group {
  const group = new THREE.Group();
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: '#161d33', metalness: 0.7, roughness: 0.35 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: accent });

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.2, 0.55), pillarMaterial);
    pillar.position.set(side * 8.4, 3.1, 0);
    pillar.castShadow = true;
    group.add(pillar);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.6, 0.12), glowMaterial);
    strip.position.set(side * 8.4 + side * 0.29, 3.1, 0);
    group.add(strip);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(17.3, 0.42, 0.62), pillarMaterial);
  beam.position.y = 6.15;
  group.add(beam);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(14.6, 1.5),
    new THREE.MeshBasicMaterial({ color: '#0b1124', transparent: true, opacity: 0.92 }),
  );
  banner.position.y = 5.1;
  group.add(banner);

  const checker = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: '#e6edff' });
  const black = new THREE.MeshBasicMaterial({ color: '#070b16' });
  for (let i = 0; i < 14; i += 1) {
    for (let row = 0; row < 2; row += 1) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.02, 0.28),
        (i + row) % 2 === 0 ? white : black,
      );
      tile.position.set(-6.9 + i * 1.02 + 0.5, 4.38 + row * 0.28, 0.01);
      checker.add(tile);
    }
  }
  group.add(checker);

  const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({ color: '#e6edff' }));
  finishLine.rotation.x = -Math.PI / 2;
  finishLine.position.set(0, 0.07, 0);
  group.add(finishLine);

  group.position.set(point.x, 0, point.z);
  group.rotation.y = heading;
  return group;
}

export interface CityOptions {
  center: TrackPoint;
  radius: number;
  count: number;
  seed?: number;
  avoidRadius?: number;
}

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function createCity(options: CityOptions): THREE.Group {
  const group = new THREE.Group();
  const random = seededRandom(options.seed ?? 1337);
  const count = options.count;

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: '#0b1226',
    metalness: 0.35,
    roughness: 0.68,
  });
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, count);
  buildings.castShadow = true;
  buildings.receiveShadow = true;

  const stripGeometry = new THREE.BoxGeometry(1, 1, 1);
  const stripMaterial = new THREE.MeshBasicMaterial({ color: '#4c8dff' });
  const strips = new THREE.InstancedMesh(stripGeometry, stripMaterial, count);
  const stripColors = [new THREE.Color('#4c8dff'), new THREE.Color('#a06bff'), new THREE.Color('#38e8ff')];

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const avoid = options.avoidRadius ?? 34;

  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 12) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const distance = avoid + random() * (options.radius - avoid);
    const x = options.center.x + Math.cos(angle) * distance;
    const z = options.center.z + Math.sin(angle) * distance;
    const width = 4 + random() * 9;
    const depth = 4 + random() * 9;
    const height = 6 + random() * 46;

    dummy.position.set(x, height / 2, z);
    dummy.scale.set(width, height, depth);
    dummy.rotation.y = Math.floor(random() * 4) * (Math.PI / 2);
    dummy.updateMatrix();
    buildings.setMatrixAt(placed, dummy.matrix);

    color.setHSL(0.58 + random() * 0.12, 0.35, 0.05 + random() * 0.05);
    buildings.setColorAt(placed, color);

    dummy.position.set(x, height + 0.25, z);
    dummy.scale.set(width * 0.92, 0.35, depth * 0.92);
    dummy.rotation.y = 0;
    dummy.updateMatrix();
    strips.setMatrixAt(placed, dummy.matrix);
    strips.setColorAt(placed, stripColors[placed % stripColors.length]!);

    placed += 1;
  }

  buildings.count = placed;
  strips.count = placed;
  buildings.instanceColor!.needsUpdate = true;
  strips.instanceColor!.needsUpdate = true;
  group.add(buildings, strips);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(options.radius * 2.6, options.radius * 2.6),
    new THREE.MeshStandardMaterial({ color: '#050913', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const grid = new THREE.GridHelper(options.radius * 2.6, 90, '#111c36', '#0b1428');
  grid.position.y = 0.01;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.5;
  group.add(grid);

  const starsGeometry = new THREE.BufferGeometry();
  const starPositions: number[] = [];
  for (let i = 0; i < 420; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 90 + random() * 260;
    starPositions.push(
      options.center.x + Math.cos(angle) * distance,
      28 + random() * 90,
      options.center.z + Math.sin(angle) * distance,
    );
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({ color: '#bcd2ff', size: 0.65, transparent: true, opacity: 0.7 }),
  );
  group.add(stars);

  return group;
}

export function createTrackLights(points: TrackPoint[]): THREE.Group {
  const group = new THREE.Group();
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#141b2e', metalness: 0.6, roughness: 0.4 });
  const bulbGeometry = new THREE.SphereGeometry(0.22, 8, 8);
  const bulbMaterial = new THREE.MeshBasicMaterial({ color: '#9fd8ff' });

  const poleCount = Math.min(90, points.length);
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, poleCount);
  const bulbs = new THREE.InstancedMesh(bulbGeometry, bulbMaterial, poleCount);
  const dummy = new THREE.Object3D();
  const stride = Math.max(1, Math.floor(points.length / poleCount));

  for (let i = 0; i < poleCount; i += 1) {
    const point = points[(i * stride) % points.length]!;
    const next = points[((i * stride) + 1) % points.length]!;
    const angle = Math.atan2(next.x - point.x, next.z - point.z);
    const side = i % 2 === 0 ? 1 : -1;
    const offsetX = Math.cos(angle) * 9.5 * side;
    const offsetZ = -Math.sin(angle) * 9.5 * side;

    dummy.position.set(point.x + offsetX, 2.7, point.z + offsetZ);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);

    dummy.position.y = 5.45;
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
  }

  group.add(poles, bulbs);
  return group;
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}
