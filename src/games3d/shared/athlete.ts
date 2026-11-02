import * as THREE from 'three';

export interface AthleteVisual {
  group: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  torso: THREE.Mesh;
}

export function createAthlete(primary: string, secondary: string, isKeeper = false): AthleteVisual {
  const group = new THREE.Group();

  const shirt = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.62, metalness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({
    color: secondary,
    roughness: 0.5,
    emissive: secondary,
    emissiveIntensity: 0.12,
  });
  const shorts = new THREE.MeshStandardMaterial({ color: '#10192e', roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: '#c98b63', roughness: 0.85 });
  const boot = new THREE.MeshStandardMaterial({ color: '#0a0f1c', roughness: 0.4, metalness: 0.4 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.4, 4, 10), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.28), trim);
  chestStripe.position.set(0, 1.16, 0.02);
  group.add(chestStripe);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.3), shorts);
  hips.position.y = 0.8;
  hips.castShadow = true;
  group.add(hips);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin);
  head.position.y = 1.6;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#141420', roughness: 0.95 }),
  );
  hair.position.y = 1.63;
  group.add(hair);

  const legGeometry = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  const shinGeometry = new THREE.BoxGeometry(0.14, 0.34, 0.16);
  const footGeometry = new THREE.BoxGeometry(0.17, 0.1, 0.32);

  function buildLeg(side: number): THREE.Object3D {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.74, 0);
    const thigh = new THREE.Mesh(legGeometry, skin);
    thigh.position.y = -0.31;
    thigh.castShadow = true;
    hip.add(thigh);
    const shin = new THREE.Mesh(shinGeometry, shorts);
    shin.position.y = -0.62;
    hip.add(shin);
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.15), trim);
    sock.position.y = -0.82;
    hip.add(sock);
    const foot = new THREE.Mesh(footGeometry, boot);
    foot.position.set(0, -0.9, -0.08);
    foot.castShadow = true;
    hip.add(foot);
    group.add(hip);
    return hip;
  }

  const legGeometry2 = new THREE.BoxGeometry(0.12, 0.5, 0.14);
  function buildArm(side: number): THREE.Object3D {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.34, 1.42, 0);
    const upper = new THREE.Mesh(legGeometry2, skin);
    upper.position.y = -0.25;
    upper.castShadow = true;
    shoulder.add(upper);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.17), shirt);
    sleeve.position.y = -0.1;
    shoulder.add(sleeve);
    if (isKeeper) {
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), trim);
      glove.position.y = -0.52;
      shoulder.add(glove);
    }
    group.add(shoulder);
    return shoulder;
  }

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  return { group, leftLeg, rightLeg, leftArm, rightArm, torso };
}

export function createSelectionRing(color: string): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  return ring;
}

export function createPitchShadow(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
  );
}
