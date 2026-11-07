import * as THREE from 'three';
import {
  ATLAS_COLUMNS,
  ATLAS_HEIGHT,
  ATLAS_ROWS,
  ATLAS_WIDTH,
  TEXTURE_KEYS,
  TILE_PIXELS,
  generateTexture,
  tileFor,
} from './textures';

/**
 * Packs every procedural tile into one RGBA buffer. Row 0 is the top of the image, which
 * the shader accounts for by flipping v inside each tile, so no texture rows are uploaded
 * upside down. Unused tiles stay fully transparent.
 */
export function buildAtlasPixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  TEXTURE_KEYS.forEach((key, tile) => {
    if (tile >= ATLAS_COLUMNS * ATLAS_ROWS) return;
    const source = generateTexture(key);
    const column = tile % ATLAS_COLUMNS;
    const row = Math.floor(tile / ATLAS_COLUMNS);
    for (let y = 0; y < TILE_PIXELS; y += 1) {
      const target = ((row * TILE_PIXELS + y) * ATLAS_WIDTH + column * TILE_PIXELS) * 4;
      const start = y * TILE_PIXELS * 4;
      pixels.set(source.subarray(start, start + TILE_PIXELS * 4), target);
    }
  });
  return pixels;
}

export function createAtlasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_WIDTH;
  canvas.height = ATLAS_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable for the texture atlas');
  const image = context.createImageData(ATLAS_WIDTH, ATLAS_HEIGHT);
  image.data.set(buildAtlasPixels());
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // The shader already flips v per tile; uploading unflipped keeps rows predictable.
  texture.flipY = false;
  return texture;
}

export interface CraftUniforms {
  atlas: { value: THREE.Texture };
  uTime: { value: number };
  uWaterTile: { value: number };
  uLavaTile: { value: number };
  uAlphaCutoff: { value: number };
  uOpacity: { value: number };
  uDaylight: { value: number };
  fogColor: { value: THREE.Color };
  fogNear: { value: number };
  fogFar: { value: number };
}

export interface CraftMaterials {
  atlas: THREE.CanvasTexture;
  uniforms: CraftUniforms;
  opaque: THREE.ShaderMaterial;
  cutout: THREE.ShaderMaterial;
  transparent: THREE.ShaderMaterial;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aTile;

  varying vec2 vUv;
  varying float vTile;
  varying vec3 vColor;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vTile = aTile;
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * One material samples the whole atlas. `vUv` arrives in block units, so `fract` repeats
 * the tile across greedy-merged quads. v is inverted inside the tile because the atlas
 * canvas is top-down while block space is bottom-up.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D atlas;
  uniform float uTime;
  uniform float uWaterTile;
  uniform float uLavaTile;
  uniform float uAlphaCutoff;
  uniform float uOpacity;
  uniform float uDaylight;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  varying vec2 vUv;
  varying float vTile;
  varying vec3 vColor;
  varying float vFogDepth;

  void main() {
    vec2 local = fract(vUv);
    if (vTile == uWaterTile) {
      local += vec2(uTime * 0.045, uTime * 0.028);
    } else if (vTile == uLavaTile) {
      local += vec2(-uTime * 0.02, uTime * 0.055);
    }

    vec2 origin = vec2(mod(vTile, ${ATLAS_COLUMNS}.0), floor(vTile / ${ATLAS_COLUMNS}.0)) * ${TILE_PIXELS}.0;
    vec2 pixel = origin + vec2(fract(local.x), 1.0 - fract(local.y)) * ${TILE_PIXELS - 1}.0 + 0.5;
    vec4 texel = texture2D(atlas, pixel / vec2(${ATLAS_WIDTH}.0, ${ATLAS_HEIGHT}.0));
    if (texel.a < uAlphaCutoff) discard;

    vec3 lit = texel.rgb * vColor * mix(0.55, 1.0, uDaylight);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(lit, fogColor, fogFactor), texel.a * uOpacity);

    #include <colorspace_fragment>
  }
`;

function materialFor(
  uniforms: CraftUniforms,
  options: { transparent: boolean; cutoff: number; doubleSided: boolean; opacity: number },
): THREE.ShaderMaterial {
  const localUniforms: CraftUniforms = {
    ...uniforms,
    uAlphaCutoff: { value: options.cutoff },
    uOpacity: { value: options.opacity },
  };
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: localUniforms as unknown as Record<string, THREE.IUniform>,
    vertexColors: true,
    fog: true,
    transparent: options.transparent,
    depthWrite: !options.transparent,
    side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    toneMapped: true,
  });
}

export function createCraftMaterials(): CraftMaterials {
  const atlas = createAtlasTexture();
  const fog = THREE.UniformsUtils.clone(THREE.UniformsLib.fog) as {
    fogColor: { value: THREE.Color };
    fogNear: { value: number };
    fogFar: { value: number };
  };

  const uniforms: CraftUniforms = {
    atlas: { value: atlas },
    uTime: { value: 0 },
    uWaterTile: { value: tileFor('water') },
    uLavaTile: { value: tileFor('lava') },
    uAlphaCutoff: { value: 0 },
    uOpacity: { value: 1 },
    uDaylight: { value: 1 },
    fogColor: fog.fogColor,
    fogNear: fog.fogNear,
    fogFar: fog.fogFar,
  };

  return {
    atlas,
    uniforms,
    opaque: materialFor(uniforms, {
      transparent: false,
      cutoff: 0,
      doubleSided: false,
      opacity: 1,
    }),
    cutout: materialFor(uniforms, {
      transparent: false,
      cutoff: 0.5,
      doubleSided: true,
      opacity: 1,
    }),
    transparent: materialFor(uniforms, {
      transparent: true,
      cutoff: 0.02,
      doubleSided: true,
      opacity: 1,
    }),
  };
}