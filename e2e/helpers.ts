import { expect, type Page } from '@playwright/test';

export const GAMES = [
  { slug: 'neon-snake', title: 'Neon Snake' },
  { slug: 'tic-tac-toe', title: 'Tic-Tac-Toe' },
  { slug: 'memory-match', title: 'Memory Match' },
  { slug: 'rock-paper-scissors', title: 'Rock Paper Scissors' },
  { slug: 'reaction-time-challenge', title: 'Reaction Time Challenge' },
  { slug: 'rift-breaker', title: 'Rift Breaker' },
  { slug: 'math-sprint', title: 'Math Sprint' },
  { slug: 'neon-apex', title: 'Neon Apex' },
  { slug: 'rift-striker', title: 'Rift Striker' },
  { slug: 'neon-city-drive', title: 'Neon City Drive' },
  { slug: 'neon-harvest', title: 'Neon Harvest' },
  { slug: 'rift-transit', title: 'Rift Transit' },
  { slug: 'grid-supply', title: 'Grid Supply' },
  { slug: 'rift-colony', title: 'Rift Colony' },
  { slug: 'orbit-market', title: 'Orbit Market' },
  { slug: 'neon-diner', title: 'Neon Diner' },
  { slug: 'skyport', title: 'Skyport' },
  { slug: 'rift-hospital', title: 'Rift Hospital' },
  { slug: 'park-pulse', title: 'Park Pulse' },
  { slug: 'factory-line', title: 'Factory Line' },
  { slug: 'cargo-ring', title: 'Cargo Ring' },
  { slug: 'aqua-grid', title: 'Aqua Grid' },
  { slug: 'signal-stack', title: 'Signal Stack' },
  { slug: 'rift-runner', title: 'Rift Runner' },
  { slug: 'rift-tactics', title: 'Rift Tactics' },
  { slug: 'rift-chess', title: 'Rift Chess' },
  { slug: 'neon-rush', title: 'Neon Rush' },
  { slug: 'penalty-protocol', title: 'Penalty Protocol' },
  { slug: 'hoop-circuit', title: 'Hoop Circuit' },
  { slug: 'lawn-protocol', title: 'Lawn Protocol' },
] as const;

export interface ErrorLog {
  pageErrors: string[];
  consoleErrors: string[];
}

export function collectErrors(page: Page): ErrorLog {
  const log: ErrorLog = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (error) => log.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') log.consoleErrors.push(message.text());
  });
  return log;
}

export function expectNoErrors(log: ErrorLog): void {
  expect(log.pageErrors, 'uncaught page errors').toEqual([]);
  expect(log.consoleErrors, 'console errors').toEqual([]);
}
