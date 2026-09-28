import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, sizes, space, typography } from '@/theme';
import { AppText } from './AppText';

interface InputProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  error?: string | null;
  secret?: boolean;
}

export function Input({ label, error, secret, editable = true, ...rest }: InputProps) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color={colors.textSecondary}>
        {label}
      </AppText>
      <View style={[styles.field, error ? styles.fieldError : null, !editable && styles.disabled]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secret && !revealed}
          autoCorrect={false}
          autoCapitalize="none"
          editable={editable}
          accessibilityLabel={label}
          {...rest}
        />
        {secret && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={space.sm}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={styles.eye}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={sizes.iconSmall}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    paddingHorizontal: space.md,
  },
  fieldError: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  input: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: space.sm },
  eye: { padding: space.xs },
});
