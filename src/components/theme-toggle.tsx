import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useAppTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  style?: ViewStyle;
}

export function ThemeToggle({ style }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Pressable
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        style
      ]}
      accessibilityLabel="Toggle theme"
    >
      {isDark ? (
        <Sun size={20} color="#ffffff" strokeWidth={2} />
      ) : (
        <Moon size={20} color="#000000" strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 10,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
});
