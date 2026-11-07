import { readJson, writeJson } from '../../lib/storage';

/*
 * The 3D games share one mute choice so a visitor who mutes the engine noise in
 * one game does not have to mute it again in the next.
 */
export const THREE_D_MUTE_KEY = 'neonrift:3d-muted';

export function readMutedPreference(): boolean {
  return readJson<unknown>(THREE_D_MUTE_KEY) === true;
}

export function writeMutedPreference(muted: boolean): void {
  writeJson(THREE_D_MUTE_KEY, muted);
}