import { itemSpec } from './items';

/** Seconds between melee swings. */
export const MELEE_COOLDOWN = 0.5;
/** Knockback impulse applied to a struck creature, in metres per second. */
export const MELEE_KNOCKBACK = 4;
/** Damage of a bare-handed or non-sword swing. */
export const UNARMED_MELEE = 3;

/**
 * Sword damage comes from the item registry's tool tier table; every other held id
 * (including blocks and non-sword tools) swings for the unarmed value.
 */
export function meleeDamage(heldId: number | null | undefined): number {
  if (heldId === null || heldId === undefined) return UNARMED_MELEE;
  const spec = itemSpec(heldId);
  if (!spec?.tool || spec.tool.kind !== 'sword') return UNARMED_MELEE;
  return spec.tool.attack;
}

export function attackReady(cooldownRemaining: number): boolean {
  return !(cooldownRemaining > 0);
}

/** Horizontal knockback along the player's facing direction (yaw only). */
export function knockbackVector(yaw: number): { x: number; z: number } {
  return {
    x: -Math.sin(yaw) * MELEE_KNOCKBACK,
    z: -Math.cos(yaw) * MELEE_KNOCKBACK,
  };
}