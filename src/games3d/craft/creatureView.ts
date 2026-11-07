import * as THREE from 'three';
import type { CreatureKind, CreatureState } from './creatures';

export interface CreatureVisual {
  id: number;
  state: CreatureState;
}

interface Body {
  group: THREE.Group;
  glow: THREE.MeshStandardMaterial[];
  flash: number;
}

function standard(color: number, emissive = 0x000000, intensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.62,
    metalness: 0.18,
  });
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function buildGloomling(): Body {
  const group = new THREE.Group();
  const hide = standard(0x17313d, 0x1f6f6a, 0.35);
  const belly = standard(0x0f2029);
  const eye = standard(0x9ffcf0, 0x5ef2c0, 2.4);
  group.add(box(0.58, 0.6, 0.78, hide, 0, 0.55, 0));
  group.add(box(0.42, 0.34, 0.5, belly, 0, 0.24, 0.12));
  group.add(box(0.46, 0.4, 0.44, hide, 0, 1.02, -0.16));
  group.add(box(0.09, 0.1, 0.06, eye, -0.12, 1.06, -0.4));
  group.add(box(0.09, 0.1, 0.06, eye, 0.12, 1.06, -0.4));
  group.add(box(0.13, 0.3, 0.13, hide, -0.18, 0.14, 0.2));
  group.add(box(0.13, 0.3, 0.13, hide, 0.18, 0.14, 0.2));
  // Spines make the silhouette read at night without any glow of their own.
  group.add(box(0.08, 0.22, 0.08, belly, 0, 0.92, 0.1));
  return { group, glow: [eye], flash: 0 };
}

function buildWisp(): Body {
  const group = new THREE.Group();
  const core = standard(0xff9a4d, 0xff6a1f, 2.8);
  const glass = new THREE.MeshBasicMaterial({
    color: 0xff8a3d,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringMaterial = standard(0xffc98a, 0xff7a2a, 2);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), core);
  body.position.y = 0;
  group.add(body);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), glass);
  group.add(shell);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 24), ringMaterial);
  ring.rotation.x = Math.PI / 2.3;
  group.add(ring);
  return { group, glow: [core, ringMaterial], flash: 0 };
}

function buildBody(kind: CreatureKind): Body {
  return kind === 'gloomling' ? buildGloomling() : buildWisp();
}

/**
 * Keeps one scene group per live creature. Bodies are built once per spawn and disposed on
 * removal; per-frame work is position, a small hover bob and a flash decay.
 */
export class CreatureViews {
  private readonly bodies = new Map<number, Body>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(visuals: readonly CreatureVisual[], time: number): void {
    const seen = new Set<number>();
    for (const visual of visuals) {
      seen.add(visual.id);
      let body = this.bodies.get(visual.id);
      if (!body) {
        body = buildBody(visual.state.kind);
        this.scene.add(body.group);
        this.bodies.set(visual.id, body);
      }
      const state = visual.state;
      body.group.position.set(state.position.x, state.position.y, state.position.z);
      if (state.kind === 'gloomling') {
        body.group.position.y += Math.abs(Math.sin(time * 7 + visual.id)) * 0.03;
      } else {
        body.group.position.y += 1.15 + Math.sin(time * 2.2 + visual.id) * 0.16;
        body.group.rotation.y = time * 0.8 + visual.id;
      }
      if (body.flash > 0) {
        body.flash = Math.max(0, body.flash - 0.08);
        const pulse = 1 + body.flash * 2.5;
        for (const material of body.glow) material.emissiveIntensity = pulse;
      }
    }
    for (const [id, body] of this.bodies) {
      if (seen.has(id)) continue;
      this.removeBody(body);
      this.bodies.delete(id);
    }
  }

  flash(id: number): void {
    const body = this.bodies.get(id);
    if (body) body.flash = Math.min(1, body.flash + 0.8);
  }

  dispose(): void {
    for (const body of this.bodies.values()) this.removeBody(body);
    this.bodies.clear();
  }

  private removeBody(body: Body): void {
    body.group.removeFromParent();
    body.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
  }
}