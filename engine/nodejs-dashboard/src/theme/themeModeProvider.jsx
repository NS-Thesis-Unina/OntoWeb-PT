import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createNeutralTheme } from './themeSetup';

const ThemeModeContext = createContext({
  mode: 'dark',
  toggleMode: () => {},
  setMode: (m) => {},
});

/**
 * Component: Theme Mode Provider
 *
 * Supplies a light/dark theme context for the entire app and persists
 * the user's choice to localStorage. On first load, it restores the last
 * saved mode and avoids UI flicker by waiting until the theme is ready.
 *
 * Context API:
 * - mode: current color scheme ('light' | 'dark')
 * - setMode(next?: 'light' | 'dark'): set explicitly or toggle when omitted
 * - toggleMode(): convenience alias for toggling
 *
 * Persistence:
 * - localStorage key: 'ui_theme_mode'
 *
 * Wraps children with a ThemeProvider and exposes the theme mode context.
 *
 * @param {{ children: React.ReactNode, defaultMode?: 'light'|'dark' }} props
 * @returns {JSX.Element}
 */
export function ThemeModeProvider({ children, defaultMode = 'dark' }) {
  // Current mode string ('light' | 'dark')
  const [mode, setModeState] = useState(defaultMode);
  // MUI theme object built from the current mode
  const [muiTheme, setMuiTheme] = useState(() => createNeutralTheme(defaultMode));
  // Ready flag prevents rendering before the theme is initialized (avoids flash)
  const [ready, setReady] = useState(false);

  // Initialize from localStorage (if available) on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ui_theme_mode');
      const initial = saved === 'light' || saved === 'dark' ? saved : defaultMode;

      setModeState(initial);
      setMuiTheme(createNeutralTheme(initial));
    } catch (e) {
      // If storage is unavailable, fall back to provided default
      setModeState(defaultMode);
      setMuiTheme(createNeutralTheme(defaultMode));
    } finally {
      // Only render children once theme is resolved
      setReady(true);
    }
  }, [defaultMode]);

  /**
   * Set a specific mode or toggle if no argument is provided.
   *
   * @param {'light'|'dark'} [nextMode] - Optional explicit target mode.
   */
  const setMode = (nextMode) => {
    const newMode = typeof nextMode === 'string' ? nextMode : mode === 'dark' ? 'light' : 'dark';

    // Update React state and rebuild the theme
    setModeState(newMode);
    setMuiTheme(createNeutralTheme(newMode));

    // Persist preference (best-effort)
    try {
      localStorage.setItem('ui_theme_mode', newMode);
    } catch (e) {
      // ignore storage errors (private mode, quotas, etc.)
    }
  };

  /** Convenience toggler */
  const toggleMode = () => setMode();

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {/* Defer rendering until theme is ready to avoid momentary mismatch */}
      {ready ? (
        <ThemeProvider theme={muiTheme}>
          {/* Normalize base styles and apply theme background/text */}
          <CssBaseline />
          {children}
        </ThemeProvider>
      ) : null}
    </ThemeModeContext.Provider>
  );
}

/** Hook to access the theme mode context anywhere in the app */
export const useThemeMode = () => useContext(ThemeModeContext);

export default ThemeModeProvider;
