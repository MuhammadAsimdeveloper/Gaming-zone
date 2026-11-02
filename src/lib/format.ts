const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return dateFormatter.format(date);
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown time';

  const seconds = Math.round((timestamp - now) / 1000);
  const absolute = Math.abs(seconds);

  if (absolute < 60) return 'just now';
  if (absolute < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute');
  if (absolute < 86_400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour');
  if (absolute < 604_800) return relativeFormatter.format(Math.round(seconds / 86_400), 'day');

  return formatDate(iso);
}

export function formatScore(score: number): string {
  return new Intl.NumberFormat('en-US').format(score);
}
