/**
 * Theme Mode Context & Provider
 *
 * This module exposes a React context and provider responsible for:
 * - Managing the current UI color mode: "dark" or "light".
 * - Persisting the selected mode in `browser.storage.local` under `ui_theme_mode`.
 * - Creating and providing a Material UI theme instance based on the selected mode.
 *
 * Architectural Notes:
 * - The actual MUI theme object is created via `createNeutralTheme` in `themeSetup`.
 * - The `ready` flag prevents rendering children until the initial theme mode has
 *   been restored from storage, avoiding a flash of incorrect theme on load.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createNeutralTheme } from './themeSetup';
import browser from 'webextension-polyfill';

/**
 * ThemeModeContext
 *
 * Exposes:
 * - mode: current color mode ("dark" | "light").
 * - toggleMode: helper to switch between light and dark.
 * - setMode: setter to explicitly set a given mode.
 */
const ThemeModeContext = createContext({
  mode: 'dark',
  toggleMode: () => {},
  setMode: (m) => {},
});

/**
 * ThemeModeProvider
 *
 * Wraps the application with:
 * - ThemeModeContext.Provider: exposes mode and setters to the tree.
 * - MUI ThemeProvider: injects the computed theme into MUI components.
 * - CssBaseline: resets default browser styles.
 *
 * Persistent Behavior:
 * - On mount, it reads `ui_theme_mode` from `browser.storage.local`.
 * - If a stored mode is found, it becomes the initial mode.
 * - If not, `defaultMode` is used ("dark" by default).
 * - Any subsequent mode change is persisted to storage.
 *
 * @param {{ children: React.ReactNode, defaultMode?: "dark" | "light" }} props
 * @returns {JSX.Element}
 */
export function ThemeModeProvider({ children, defaultMode = 'dark' }) {
  const [mode, setModeState] = useState(defaultMode);
  const [muiTheme, setMuiTheme] = useState(() => createNeutralTheme(defaultMode));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Read previously stored theme mode from extension local storage
        const obj = await browser.storage.local.get('ui_theme_mode').catch(() => ({}));

        const saved = obj?.ui_theme_mode ?? null;
        const initial = saved || defaultMode;

        if (!mounted) return;

        setModeState(initial);
        setMuiTheme(createNeutralTheme(initial));
      } catch (e) {
        // Fallback: if storage access fails, revert to defaultMode
        setModeState(defaultMode);
        setMuiTheme(createNeutralTheme(defaultMode));
      } finally {
        if (mounted) setReady(true);
      }
    })();

    // Prevent state updates if the component unmounts during async work
    return () => {
      mounted = false;
    };
  }, [defaultMode]);

  /**
   * Updates the current mode.
   *
   * If `nextMode` is a string, it is used as-is.
   * If `nextMode` is not provided, the mode is toggled between dark/light.
   *
   * The new mode is:
   * - stored in React state,
   * - used to rebuild the MUI theme,
   * - persisted to `browser.storage.local`.
   *
   * @param {"dark" | "light" | undefined} nextMode
   */
  const setMode = async (nextMode) => {
    const newMode = typeof nextMode === 'string' ? nextMode : mode === 'dark' ? 'light' : 'dark';

    setModeState(newMode);
    setMuiTheme(createNeutralTheme(newMode));

    try {
      await browser.storage.local.set({ ui_theme_mode: newMode }).catch(() => {});
    } catch (e) {
      // Ignore storage errors; theme still updates in memory
    }
  };

  /**
   * Convenience helper: toggles between "dark" and "light".
   */
  const toggleMode = () => setMode();

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {ready ? (
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      ) : null}
    </ThemeModeContext.Provider>
  );
}

/**
 * Custom hook to consume the ThemeModeContext.
 *
 * @returns {{ mode: "dark" | "light", setMode: Function, toggleMode: Function }}
 */
export const useThemeMode = () => useContext(ThemeModeContext);

export default ThemeModeProvider;
