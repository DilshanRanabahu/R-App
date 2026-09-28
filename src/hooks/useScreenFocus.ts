import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** True while the current screen is focused; used to stop polling off-screen. */
export function useScreenFocus(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
