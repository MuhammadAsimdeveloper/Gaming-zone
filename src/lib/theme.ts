export type Theme = 'day' | 'night';

export function themeForPath(pathname: string): Theme {
  return pathname === '/game' || pathname.startsWith('/game/') ? 'night' : 'day';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const night = theme === 'night';

  root.dataset.theme = theme;
  root.style.colorScheme = night ? 'dark' : 'light';

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = night ? '#070B16' : '#F5F1E6';

  const colorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.content = night ? 'dark' : 'light';
}
