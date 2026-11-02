import { ADMIN_PASSCODE_HASH } from '../config/site';

/*
 * Dormant scaffolding: no admin route or dashboard is shipped in this build.
 * If one is added, keep it explicitly local-only; a browser passcode is not
 * server authentication and must never be described as secure.
 */
const SESSION_KEY = 'neonrift:admin-session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function isAdminConfigured(): boolean {
  return Boolean(ADMIN_PASSCODE_HASH);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  if (!ADMIN_PASSCODE_HASH || !passcode) return false;

  const hash = await sha256Hex(passcode);
  return hash === ADMIN_PASSCODE_HASH;
}

export function startAdminSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ startedAt: Date.now() }));
  } catch {
    // Session storage can be blocked; the in-memory gate still applies for this page.
  }
}

export function hasAdminSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { startedAt?: number };
    if (typeof parsed.startedAt !== 'number') return false;
    if (Date.now() - parsed.startedAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function endAdminSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

export const ADMIN_HASH_HELP =
  'Generate a SHA-256 hash of your chosen passcode and set it as VITE_ADMIN_PASSCODE_HASH.';
