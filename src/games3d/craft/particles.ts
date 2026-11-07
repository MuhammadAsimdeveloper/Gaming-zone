import * as THREE from 'three';

const MAX_PARTICLES = 360;
const HIDDEN_Y = -1000;

/**
 * Pooled point particles for block breaks, hits and motes. Dead particles are parked far
 * below the world instead of being removed, so the draw call and buffers never churn.
 */
export class ParticleField {
  readonly points: THREE.Points;
  private readonly positions = new Float32Array(MAX_PARTICLES * 3);
  private readonly colors = new Float32Array(MAX_PARTICLES * 3);
  private readonly baseColors = new Float32Array(MAX_PARTICLES * 3);
  private readonly velocities = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      this.positions[index * 3 + 1] = HIDDEN_Y;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const material = new THREE.PointsMaterial({
      size: 0.1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.name = 'craft-particles';
    scene.add(this.points);
  }

  burst(
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    count: number,
    speed = 2.4,
    spread = 0.35,
  ): void {
    for (let index = 0; index < count; index += 1) {
      const slot = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const base = slot * 3;
      this.positions[base] = x + (Math.random() - 0.5) * spread;
      this.positions[base + 1] = y + (Math.random() - 0.5) * spread;
      this.positions[base + 2] = z + (Math.random() - 0.5) * spread;
      this.baseColors[base] = color.r;
      this.baseColors[base + 1] = color.g;
      this.baseColors[base + 2] = color.b;
      this.colors[base] = color.r;
      this.colors[base + 1] = color.g;
      this.colors[base + 2] = color.b;
      this.velocities[base] = (Math.random() - 0.5) * speed;
      this.velocities[base + 1] = Math.random() * speed + speed * 0.35;
      this.velocities[base + 2] = (Math.random() - 0.5) * speed;
      this.maxLife[slot] = 0.45 + Math.random() * 0.45;
      this.life[slot] = this.maxLife[slot];
    }
  }

  update(dt: number): void {
    let changed = false;
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      const remaining = this.life[index]!;
      if (remaining <= 0) continue;
      changed = true;
      const base = index * 3;
      const next = remaining - dt;
      if (next <= 0) {
        this.life[index] = 0;
        this.positions[base + 1] = HIDDEN_Y;
        continue;
      }
      this.life[index] = next;
      this.velocities[base + 1]! -= 16 * dt;
      this.positions[base]! += this.velocities[base]! * dt;
      this.positions[base + 1]! += this.velocities[base + 1]! * dt;
      this.positions[base + 2]! += this.velocities[base + 2]! * dt;
      const fade = next / this.maxLife[index]!;
      this.colors[base] = this.baseColors[base]! * fade;
      this.colors[base + 1] = this.baseColors[base + 1]! * fade;
      this.colors[base + 2] = this.baseColors[base + 2]! * fade;
    }
    if (!changed) return;
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points.removeFromParent();
  }
}