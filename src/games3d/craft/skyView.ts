import * as THREE from 'three';
import { CYCLE_SECONDS, type SkyPalette } from './daynight';

const STAR_COUNT = 600;

function srgb(target: THREE.Color, color: { r: number; g: number; b: number }): THREE.Color {
  return target.setRGB(color.r, color.g, color.b, THREE.SRGBColorSpace);
}

function radialTexture(inner: string, outer: string, size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable for the sky texture');
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.03,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.45, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft procedural cloud sheet: blurred blobs, seamless enough at this scale. */
function cloudTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable for the cloud texture');
  context.clearRect(0, 0, size, size);
  for (let index = 0; index < 46; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 8 + Math.random() * 22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const DOME_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  varying vec3 vDirection;
  void main() {
    float h = clamp(vDirection.y * 1.15 + 0.08, 0.0, 1.0);
    vec3 color = mix(horizonColor, topColor, smoothstep(0.0, 0.7, h));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function starGeometry(radius: number): THREE.BufferGeometry {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let index = 0; index < STAR_COUNT; index += 1) {
    const y = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    positions[index * 3] = Math.cos(angle) * r * radius;
    positions[index * 3 + 1] = y * radius;
    positions[index * 3 + 2] = Math.sin(angle) * r * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function cloudPlane(
  texture: THREE.CanvasTexture,
  size: number,
  height: number,
  opacity: number,
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = height;
  mesh.renderOrder = 4;
  return mesh;
}

/**
 * The sky is a camera-following dome plus a fixed star sphere, two celestial sprites and
 * two scrolling cloud sheets. Everything is unlit and fog-free; the palette is applied per
 * frame so dusk, night and dawn read as one continuous gradient.
 */
export class SkyView {
  readonly group = new THREE.Group();
  private readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly sun: THREE.Sprite;
  private readonly moon: THREE.Sprite;
  private readonly sunTexture: THREE.CanvasTexture;
  private readonly moonTexture: THREE.CanvasTexture;
  private readonly cloudTexture: THREE.CanvasTexture;
  private readonly clouds: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>;
  private readonly sunColor = new THREE.Color();
  private readonly topColor = new THREE.Color();
  private readonly horizonColor = new THREE.Color();
  private readonly cloudTint = new THREE.Color();

  constructor(scene: THREE.Scene, radius: number) {
    this.group.name = 'craft-sky';
    scene.add(this.group);

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.86, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: DOME_VERTEX,
        fragmentShader: DOME_FRAGMENT,
        uniforms: {
          topColor: { value: this.topColor },
          horizonColor: { value: this.horizonColor },
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    this.stars = new THREE.Points(
      starGeometry(radius * 0.94),
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.8,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // Transparent objects draw after the terrain, so the depth buffer must exist.
        depthTest: true,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.sunTexture = radialTexture('rgba(255,250,225,1)', 'rgba(255,190,90,0)');
    this.moonTexture = radialTexture('rgba(228,240,255,1)', 'rgba(150,180,255,0)');
    this.sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.sunTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sun.scale.setScalar(radius * 0.22);
    this.sun.renderOrder = -8;
    this.group.add(this.sun);

    this.moon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.moonTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        fog: false,
        opacity: 0,
      }),
    );
    this.moon.scale.setScalar(radius * 0.14);
    this.moon.renderOrder = -8;
    this.group.add(this.moon);

    this.cloudTexture = cloudTexture();
    this.clouds = [
      cloudPlane(this.cloudTexture, 210, 64, 0.34),
      cloudPlane(this.cloudTexture, 190, 74, 0.22),
    ];
    for (const cloud of this.clouds) scene.add(cloud);
  }

  update(palette: SkyPalette, secondsIntoCycle: number, center: THREE.Vector3): void {
    this.group.position.copy(center);

    srgb(this.topColor, palette.top);
    srgb(this.horizonColor, palette.fog);
    srgb(this.sunColor, palette.sun);

    const sunMaterial = this.sun.material;
    sunMaterial.color.copy(this.sunColor);
    // One full orbit per cycle; the sun crosses the sky over its 360 s day.
    const angle = (secondsIntoCycle / CYCLE_SECONDS) * Math.PI * 2;
    const orbit = this.dome.geometry.parameters.radius;
    const sunX = Math.cos(angle) * orbit * 0.62;
    const sunY = Math.sin(angle) * orbit;
    const sunZ = Math.cos(angle) * orbit * 0.34;
    const elevation = Math.sin(angle);
    this.sun.position.set(sunX, sunY, sunZ);
    sunMaterial.opacity = THREE.MathUtils.clamp((elevation + 0.12) * 3, 0, 1);

    const moonMaterial = this.moon.material;
    moonMaterial.color.setRGB(
      0.85 + palette.starOpacity * 0.15,
      0.9 + palette.starOpacity * 0.1,
      1,
      THREE.SRGBColorSpace,
    );
    this.moon.position.set(-sunX, -sunY, -sunZ);
    moonMaterial.opacity = THREE.MathUtils.clamp((-elevation + 0.12) * 3, 0, 1);

    this.stars.material.opacity = palette.starOpacity;
    this.stars.rotation.y = secondsIntoCycle * 0.004;

    const daylight = palette.daylight;
    this.cloudTint.copy(this.horizonColor).lerp(this.sunColor, 0.45);
    for (const cloud of this.clouds) cloud.material.color.copy(this.cloudTint);
    this.clouds[0]!.material.opacity = 0.12 + 0.26 * daylight;
    this.clouds[1]!.material.opacity = 0.08 + 0.18 * daylight;
    this.cloudTexture.offset.set(secondsIntoCycle * 0.0018, secondsIntoCycle * 0.0007);
    this.clouds[0]!.position.set(center.x, center.y + 64, center.z);
    this.clouds[1]!.position.set(center.x + 30, center.y + 74, center.z - 24);
  }

  setCloudsVisible(visible: boolean): void {
    for (const cloud of this.clouds) cloud.visible = visible;
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      } else if (object instanceof THREE.Sprite) {
        object.material.dispose();
      }
    });
    this.group.removeFromParent();
    for (const cloud of this.clouds) {
      cloud.geometry.dispose();
      cloud.material.dispose();
      cloud.removeFromParent();
    }
    this.sunTexture.dispose();
    this.moonTexture.dispose();
    this.cloudTexture.dispose();
  }
}