/** Radians below straight up/down, so the view never flips over the pole. */
export const MAX_PITCH = Math.PI / 2 - 0.01;
export const DEFAULT_SENSITIVITY = 0.0022;

export interface LookAngles {
  yaw: number;
  pitch: number;
}

export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  const wrapped = angle % turn;
  if (wrapped > Math.PI) return wrapped - turn;
  if (wrapped <= -Math.PI) return wrapped + turn;
  return wrapped;
}

/**
 * Pointer deltas are in screen pixels: moving right turns the view right (decreasing yaw,
 * since yaw 0 faces -z) and moving up lifts the view. Pitch clamps; yaw wraps.
 */
export function applyLook(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  sensitivity = DEFAULT_SENSITIVITY,
): LookAngles {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(sensitivity)) {
    return { yaw, pitch };
  }
  const nextYaw = wrapAngle(yaw - dx * sensitivity);
  const nextPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - dy * sensitivity));
  return { yaw: nextYaw, pitch: nextPitch };
}