import { itemTextureKey, itemTint } from './itemView';
import { generateTexture } from './textures';

const TILE = 16;
const cache = new Map<number, string>();

function tintStyle(color: number): { fill: string; edge: string } {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return {
    fill: `rgb(${r} ${g} ${b})`,
    edge: `rgb(${Math.min(255, r + 70)} ${Math.min(255, g + 70)} ${Math.min(255, b + 70)})`,
  };
}

/**
 * Renders a slot icon once per item id: real block textures for placeable blocks,
 * a tinted diamond for tools and materials. Cached as a data URL.
 */
export function itemIcon(id: number): string | null {
  if (typeof document === 'undefined') return null;
  const cached = cache.get(id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const key = itemTextureKey(id);
  if (key) {
    const pixels = generateTexture(key);
    const image = context.createImageData(TILE, TILE);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  } else {
    const { fill, edge } = tintStyle(itemTint(id));
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(8, 1);
    context.lineTo(15, 8);
    context.lineTo(8, 15);
    context.lineTo(1, 8);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.fillRect(4, 4, 2, 2);
  }

  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}