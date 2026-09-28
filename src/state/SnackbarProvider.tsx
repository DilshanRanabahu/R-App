import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, radius, sizes, space } from '@/theme';

interface SnackbarAction {
  label: string;
  onPress: () => void;
}

interface SnackbarContextValue {
  show: (message: string, action?: SnackbarAction) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({ show: () => undefined });

export function useSnackbar(): SnackbarContextValue {
  return useContext(SnackbarContext);
}

const DURATION_MS = 3000;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ message: string; action?: SnackbarAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, action?: SnackbarAction) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent({ message, action });
    timer.current = setTimeout(() => setCurrent(null), action ? DURATION_MS * 2 : DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {current && (
        <View
          pointerEvents="box-none"
          style={[styles.wrap, { bottom: insets.bottom + sizes.tabBar + space.sm }]}
        >
          <View style={styles.bar} accessibilityLiveRegion="polite">
            <AppText variant="body" color={colors.onPrimary} style={styles.text}>
              {current.message}
            </AppText>
            {current.action && (
              <Pressable
                onPress={() => {
                  current.action?.onPress();
                  setCurrent(null);
                }}
                hitSlop={space.sm}
                accessibilityRole="button"
              >
                <AppText variant="label" color={colors.primaryBg}>
                  {current.action.label}
                </AppText>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg },
  bar: {
    backgroundColor: colors.snackbar,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  text: { flex: 1 },
});
