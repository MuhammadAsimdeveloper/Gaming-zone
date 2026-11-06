// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StreetCricketGame from './StreetCricketGame';
import {
  RECORDS_KEY,
  SETTINGS_KEY,
  loadSettings,
  saveRecords,
  EMPTY_RECORDS,
} from './persistence';
import { DISTRICTS } from './teams';

function byText(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

function option(scope: HTMLElement, group: string, label: string): HTMLButtonElement {
  const container = scope.querySelector<HTMLElement>(`[role="group"][aria-label="${group}"]`);
  if (!container) throw new Error(`Missing group ${group}`);
  const found = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing option ${label} in ${group}`);
  return found;
}

describe('StreetCricketGame setup', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const mount = () => act(() => root.render(<StreetCricketGame />));

  it('renders the three formats, every district and the start control', () => {
    mount();
    expect(container.textContent).toContain('Street Cricket');
    expect(option(container, 'Match format', 'Super Over')).toBeTruthy();
    expect(option(container, 'Match format', 'Rooftop Chase')).toBeTruthy();
    expect(option(container, 'Match format', 'Nets')).toBeTruthy();
    for (const district of DISTRICTS) {
      expect(byText(container, district.name)).toBeTruthy();
    }
    expect(byText(container, 'Take the rooftop')).toBeTruthy();
    expect(container.textContent).toContain('6 balls · 2 wickets');
  });

  it('updates the format summary and persists the choice', () => {
    mount();
    act(() => option(container, 'Match format', 'Rooftop Chase').click());
    expect(container.textContent).toContain('30 balls · 6 wickets');
    expect(container.textContent).toContain('target generated at the toss');

    act(() => option(container, 'Match format', 'Nets').click());
    expect(container.textContent).toContain('18 balls · 3 wickets');
    expect(loadSettings().format).toBe('nets');
  });

  it('persists the selected district and marks it pressed', () => {
    mount();
    const target = DISTRICTS[2]!;
    const card = byText(container, target.name);
    act(() => card.click());
    expect(card.getAttribute('aria-pressed')).toBe('true');
    expect(byText(container, DISTRICTS[0]!.name).getAttribute('aria-pressed')).toBe('false');
    expect(loadSettings().districtId).toBe(target.id);
  });

  it('shows saved records from this browser', () => {
    saveRecords({
      ...EMPTY_RECORDS,
      games: 6,
      wins: 4,
      bestSuperOver: 21,
      bestChase: 63,
      bestNets: 38,
      sixes: 9,
      fours: 17,
    });
    mount();
    expect(container.textContent).toContain('SO best');
    expect(container.textContent).toContain('21');
    expect(container.textContent).toContain('Chase best');
    expect(container.textContent).toContain('63');
    expect(container.textContent).toContain('Nets best');
    expect(container.textContent).toContain('38');
    expect(container.textContent).toContain('4/6');
    expect(container.textContent).toContain('9 sixes and 17 fours');
  });

  it('treats malformed stored settings and records as defaults', () => {
    window.localStorage.setItem(RECORDS_KEY, '{"version":1,"games":-4}');
    window.localStorage.setItem(SETTINGS_KEY, '{"version":99,"format":"golf"}');
    mount();
    expect(container.textContent).toContain('6 balls · 2 wickets');
    expect(option(container, 'Match format', 'Super Over').getAttribute('aria-pressed')).toBe('true');
    expect(loadSettings().format).toBe('super-over');
    expect(container.textContent).toContain('0/0');
  });

  it('reports a friendly error when WebGL is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    mount();
    act(() => byText(container, 'Take the rooftop').click());
    expect(container.textContent).toContain(
      'The 3D rooftop could not start. Try a browser or device with WebGL enabled.',
    );
  });
});
