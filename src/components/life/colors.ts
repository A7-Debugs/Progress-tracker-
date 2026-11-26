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

/** Categorical slots for multi-series charts, in fixed order (validated for colour-blind separation and contrast on the dark surface). */
export const SERIES = ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b'];
