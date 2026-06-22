import { useAppTheme } from '../context/ThemeContext';

export function useColorScheme() {
  const { resolvedTheme } = useAppTheme();
  return resolvedTheme;
}
