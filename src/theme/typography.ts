import type { TextStyle } from 'react-native';

// DESIGN.md §4 — system font, sizes / line heights / weights.
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

// Live numbers must not shift width as they update.
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };
