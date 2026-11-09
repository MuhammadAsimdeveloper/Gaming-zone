function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hudEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => hudEqual(value, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => hudEqual(a[key], b[key]));
  }
  return false;
}

export class HudPump<T> {
  private elapsed = 0;
  private last: T | null = null;

  constructor(private readonly emit: (hud: T) => void, private readonly intervalSeconds = 0.1) {}

  reset(): void {
    this.elapsed = 0;
    this.last = null;
  }

  push(deltaSeconds: number, build: () => T, force = false): boolean {
    this.elapsed += deltaSeconds;
    if (!force && this.elapsed < this.intervalSeconds - 1e-6) return false;
    this.elapsed = 0;
    const next = build();
    if (!force && this.last !== null && hudEqual(this.last, next)) return false;
    this.last = next;
    this.emit(next);
    return true;
  }
}
