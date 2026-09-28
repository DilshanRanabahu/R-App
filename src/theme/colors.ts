// DESIGN.md §3 — light theme only.
export const colors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  border: '#E3E7ED',
  textPrimary: '#1F2937',
  textSecondary: '#5B6472',
  textMuted: '#8A93A0',
  onPrimary: '#FFFFFF',

  primary: '#2F6FEB',
  primaryBg: '#EAF1FE',
  success: '#1E9E5A',
  successBg: '#E7F6EE',
  warning: '#D98A00',
  warningBg: '#FFF4DE',
  danger: '#D93A3A',
  dangerBg: '#FDECEC',
  info: '#7A5AF8',
  infoBg: '#F1EDFE',

  snackbar: '#1F2937',
  overlay: 'rgba(31, 41, 55, 0.4)',
} as const;

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function toneColors(tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'primary':
      return { fg: colors.primary, bg: colors.primaryBg };
    case 'success':
      return { fg: colors.success, bg: colors.successBg };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningBg };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerBg };
    case 'info':
      return { fg: colors.info, bg: colors.infoBg };
    case 'neutral':
      return { fg: colors.textSecondary, bg: colors.surfaceMuted };
  }
}
