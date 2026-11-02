import * as THREE from 'three';

export const PITCH_HALF_X = 25;
export const PITCH_HALF_Z = 37.5;
export const GOAL_HALF_WIDTH = 4.4;
export const GOAL_HEIGHT = 3.1;

function addLine(
  group: THREE.Group,
  width: number,
  depth: number,
  x: number,
  z: number,
  material: THREE.Material,
): void {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  line.rotation.x = -Math.PI / 2;
  line.position.set(x, 0.035, z);
  group.add(line);
}

function buildGoal(group: THREE.Group, z: number, facing: number): void {
  const postMaterial = new THREE.MeshStandardMaterial({ color: '#eef4ff', roughness: 0.35, metalness: 0.2 });
  const netMaterial = new THREE.LineBasicMaterial({ color: '#9fb4d8', transparent: true, opacity: 0.3 });

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, GOAL_HEIGHT, 10),
      postMaterial,
    );
    post.position.set(side * GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, z);
    group.add(post);
  }

  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, GOAL_HALF_WIDTH * 2, 10),
    postMaterial,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, GOAL_HEIGHT, z);
  group.add(crossbar);

  const depth = -2.4 * facing;
  const points: number[] = [];
  const backZ = z + depth;
  for (let i = 0; i <= 12; i += 1) {
    const x = -GOAL_HALF_WIDTH + (i / 12) * GOAL_HALF_WIDTH * 2;
    points.push(x, GOAL_HEIGHT, z, x, 0.1, backZ);
    points.push(x, 0.1, z, x, 0.1, backZ);
  }
  for (let i = 0; i <= 8; i += 1) {
    const y = (i / 8) * GOAL_HEIGHT;
    for (let j = 0; j <= 8; j += 1) {
      const x = -GOAL_HALF_WIDTH + (j / 8) * GOAL_HALF_WIDTH * 2;
      points.push(x, y, backZ, x, y, z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.LineSegments(geometry, netMaterial));
}

function buildStand(
  group: THREE.Group,
  position: THREE.Vector3,
  rotation: number,
  length: number,
  seed: number,
  accent: string,
): void {
  const stand = new THREE.Group();
  const tierMaterial = new THREE.MeshStandardMaterial({ color: '#0d1528', roughness: 0.85 });

  const rows = 9;
  for (let row = 0; row < rows; row += 1) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(length, 0.55, 1.35), tierMaterial);
    tier.position.set(0, 0.3 + row * 0.55, 5.5 + row * 1.3);
    stand.add(tier);
  }

  const seatGeometry = new THREE.BoxGeometry(0.36, 0.22, 0.34);
  const seatMaterial = new THREE.MeshStandardMaterial({ color: '#38507d', roughness: 0.7 });
  const seats = new THREE.InstancedMesh(seatGeometry, seatMaterial, Math.floor(length) * 10);
  const dummy = new THREE.Object3D();
  const colors = [
    new THREE.Color('#27406b'),
    new THREE.Color('#3b2a63'),
    new THREE.Color('#1f5a63'),
    new THREE.Color('#6b2a43'),
  ];
  let index = 0;
  for (let row = 0; row < 10; row += 1) {
    for (let seat = 0; seat < Math.floor(length); seat += 1) {
      if (index >= seats.count) break;
      dummy.position.set(-length / 2 + seat + 0.5, 0.75 + row * 0.55, 6.1 + row * 1.3);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      seats.setMatrixAt(index, dummy.matrix);
      seats.setColorAt(index, colors[(seat + row + seed) % colors.length]!);
      index += 1;
    }
  }
  seats.count = index;
  seats.instanceColor!.needsUpdate = true;
  stand.add(seats);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(length + 2, 0.3, 4),
    new THREE.MeshStandardMaterial({ color: '#111b31', metalness: 0.4, roughness: 0.6 }),
  );
  roof.position.set(0, 16, 10.5);
  stand.add(roof);

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(length + 2, 0.12, 0.14),
    new THREE.MeshBasicMaterial({ color: accent }),
  );
  glow.position.set(0, 15.8, 8.6);
  stand.add(glow);

  for (let p = -1; p <= 1; p += 1) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 16, 6),
      new THREE.MeshStandardMaterial({ color: '#1b2744', metalness: 0.6, roughness: 0.4 }),
    );
    pillar.position.set(p * (length / 2 - 0.6), 8, 10.4);
    stand.add(pillar);
  }

  stand.position.copy(position);
  stand.rotation.y = rotation;
  group.add(stand);
}

export function createStadium(accent: string): THREE.Group {
  const group = new THREE.Group();

  const surround = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 140),
    new THREE.MeshStandardMaterial({ color: '#04120d', roughness: 1 }),
  );
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.02;
  surround.receiveShadow = true;
  group.add(surround);

  const stripeCount = 12;
  const stripeDepth = (PITCH_HALF_Z * 2) / stripeCount;
  for (let i = 0; i < stripeCount; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH_HALF_X * 2, stripeDepth),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? '#0d4a34' : '#0a3d2b',
        roughness: 0.92,
        metalness: 0,
      }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0, -PITCH_HALF_Z + stripeDepth / 2 + i * stripeDepth);
    stripe.receiveShadow = true;
    group.add(stripe);
  }

  const lineMaterial = new THREE.MeshBasicMaterial({ color: '#cfd9ea', transparent: true, opacity: 0.82 });
  addLine(group, PITCH_HALF_X * 2, 0.16, 0, -PITCH_HALF_Z, lineMaterial);
  addLine(group, PITCH_HALF_X * 2, 0.16, 0, PITCH_HALF_Z, lineMaterial);
  addLine(group, 0.16, PITCH_HALF_Z * 2, -PITCH_HALF_X, 0, lineMaterial);
  addLine(group, 0.16, PITCH_HALF_Z * 2, PITCH_HALF_X, 0, lineMaterial);
  addLine(group, PITCH_HALF_X * 2, 0.16, 0, 0, lineMaterial);

  const centerCircle = new THREE.Mesh(new THREE.RingGeometry(8.4, 8.58, 64), lineMaterial);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.035;
  group.add(centerCircle);
  const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), lineMaterial);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.036;
  group.add(centerSpot);

  for (const side of [-1, 1]) {
    addLine(group, 30, 0.16, 0, side * (PITCH_HALF_Z - 16.5), lineMaterial);
    addLine(group, 0.16, 16.5, -15, side * (PITCH_HALF_Z - 8.25), lineMaterial);
    addLine(group, 0.16, 16.5, 15, side * (PITCH_HALF_Z - 8.25), lineMaterial);
    addLine(group, 16, 0.16, 0, side * (PITCH_HALF_Z - 5.5), lineMaterial);
    addLine(group, 0.16, 5.5, -8, side * (PITCH_HALF_Z - 2.75), lineMaterial);
    addLine(group, 0.16, 5.5, 8, side * (PITCH_HALF_Z - 2.75), lineMaterial);

    const penaltySpot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), lineMaterial);
    penaltySpot.rotation.x = -Math.PI / 2;
    penaltySpot.position.set(0, 0.036, side * (PITCH_HALF_Z - 11));
    group.add(penaltySpot);
  }

  buildGoal(group, -PITCH_HALF_Z, 1);
  buildGoal(group, PITCH_HALF_Z, -1);

  const boardMaterial = new THREE.MeshStandardMaterial({ color: '#0a1222', roughness: 0.6, metalness: 0.3 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: accent });
  const boardHeight = 0.85;
  for (const side of [-1, 1]) {
    const sideBoard = new THREE.Mesh(new THREE.BoxGeometry(0.25, boardHeight, PITCH_HALF_Z * 2 + 6), boardMaterial);
    sideBoard.position.set(side * (PITCH_HALF_X + 4), boardHeight / 2, 0);
    group.add(sideBoard);
    const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, PITCH_HALF_Z * 2 + 6), glowMaterial);
    sideGlow.position.set(side * (PITCH_HALF_X + 4), boardHeight + 0.02, 0);
    group.add(sideGlow);

    for (const end of [-1, 1]) {
      const endZ = end * (PITCH_HALF_Z + 3.2);
      const board = new THREE.Mesh(new THREE.BoxGeometry(PITCH_HALF_X * 2 + 8, boardHeight, 0.25), boardMaterial);
      board.position.set(0, boardHeight / 2, endZ);
      group.add(board);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(PITCH_HALF_X * 2 + 8, 0.08, 0.08), glowMaterial);
      glow.position.set(0, boardHeight + 0.02, endZ);
      group.add(glow);
    }
  }

  buildStand(group, new THREE.Vector3(0, 0, PITCH_HALF_Z + 12), Math.PI, 50, 1, accent);
  buildStand(group, new THREE.Vector3(0, 0, -PITCH_HALF_Z - 12), 0, 50, 2, accent);
  buildStand(group, new THREE.Vector3(-PITCH_HALF_X - 13, 0, 0), Math.PI / 2, 62, 3, accent);
  buildStand(group, new THREE.Vector3(PITCH_HALF_X + 13, 0, 0), -Math.PI / 2, 62, 4, accent);

  const poleMaterial = new THREE.MeshStandardMaterial({ color: '#22304e', metalness: 0.7, roughness: 0.4 });
  const lampMaterial = new THREE.MeshBasicMaterial({ color: '#e9f3ff' });
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 30, 8), poleMaterial);
      pole.position.set(x * 38, 15, z * 48);
      group.add(pole);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 0.6), lampMaterial);
      panel.position.set(x * 38, 30, z * 48);
      panel.rotation.y = x * z * 0.3;
      group.add(panel);
      const light = new THREE.PointLight('#d8ecff', 120, 90, 2);
      light.position.set(x * 38, 29, z * 48);
      group.add(light);
    }
  }

  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(70, 71, 96),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.01;
  group.add(glowRing);

  return group;
}
