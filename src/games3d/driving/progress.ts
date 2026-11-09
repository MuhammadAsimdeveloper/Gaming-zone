export interface CheckpointStep {
  index: number;
  complete: boolean;
}

export function advanceCheckpoint(
  index: number,
  position: { x: number; z: number },
  route: ReadonlyArray<{ x: number; z: number }>,
  radius: number,
): CheckpointStep {
  const target = route[index];
  if (!target) return { index, complete: true };
  const distance = Math.hypot(position.x - target.x, position.z - target.z);
  if (distance > radius) return { index, complete: false };
  const next = index + 1;
  return { index: next, complete: next >= route.length };
}
