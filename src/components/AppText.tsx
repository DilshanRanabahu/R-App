import { Text, type TextProps } from 'react-native';

import { colors, tabularNums, typography, type TypographyVariant } from '@/theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  /** Fixed-width digits for live values. */
  numeric?: boolean;
}

// Hero numbers are capped so large font scales don't break layouts (DESIGN.md §4).
const MAX_SCALE: Partial<Record<TypographyVariant, number>> = { hero: 1.2, display: 1.3, title: 1.4 };

export function AppText({
  variant = 'body',
  color = colors.textPrimary,
  numeric,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[typography[variant], { color }, numeric && tabularNums, style]}
      {...rest}
    />
  );
}
