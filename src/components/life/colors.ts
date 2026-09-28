export const COLORS = {
  accent: '#7ce281',
  info: '#6ea8fe',
  warn: '#ffb454',
  danger: '#ff6b6b',
  violet: '#b392f0',
  gold: '#e8c872',
  track: '#24252c',
};

export function scoreColor(score: number | null): string {
  if (score === null) return '#4a4b56';
  if (score >= 80) return COLORS.accent;
  if (score >= 60) return COLORS.info;
  if (score >= 40) return COLORS.warn;
  return COLORS.danger;
}
