const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, [contenteditable="true"], [role="button"]';

/**
 * True when a key event belongs to a focused control rather than the game.
 * Window-level hotkeys must leave Space/Enter to buttons and links.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}
