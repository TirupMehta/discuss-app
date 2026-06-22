import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { ThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

function RootLayoutContent() {
  const { resolvedTheme } = useAppTheme();

  return (
    <NavigationThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="login" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
