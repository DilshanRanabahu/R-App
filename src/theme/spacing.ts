// DESIGN.md §5 — 4 dp grid.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  card: 14,
  control: 10,
  dialog: 16,
  pill: 999,
} as const;

export const sizes = {
  touchTarget: 48,
  listRow: 56,
  tabBar: 64,
  icon: 24,
  iconSmall: 20,
  iconLarge: 48,
  progressBar: 8,
  chart: 96,
  chartStroke: 2,
  chartDot: 4,
  chartAxis: 36,
  qrCode: 232,
} as const;

export const hairline = 1;
