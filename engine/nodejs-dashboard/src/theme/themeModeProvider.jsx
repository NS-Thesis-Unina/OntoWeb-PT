import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createNeutralTheme } from './themeSetup';

const ThemeModeContext = createContext({
  mode: 'dark',
  toggleMode: () => {},
  setMode: (m) => {},
});

export function ThemeModeProvider({ children, defaultMode = 'dark' }) {
  const [mode, setModeState] = useState(defaultMode);
  const [muiTheme, setMuiTheme] = useState(() => createNeutralTheme(defaultMode));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ui_theme_mode');
      const initial =
        saved === 'light' || saved === 'dark' ? saved : defaultMode;

      setModeState(initial);
      setMuiTheme(createNeutralTheme(initial));
    } catch (e) {
      setModeState(defaultMode);
      setMuiTheme(createNeutralTheme(defaultMode));
    } finally {
      setReady(true);
    }
  }, [defaultMode]);

  const setMode = (nextMode) => {
    const newMode =
      typeof nextMode === 'string'
        ? nextMode
        : mode === 'dark'
        ? 'light'
        : 'dark';

    setModeState(newMode);
    setMuiTheme(createNeutralTheme(newMode));

    try {
      localStorage.setItem('ui_theme_mode', newMode);
    } catch (e) {
      //ignore
    }
  };

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

export const useThemeMode = () => useContext(ThemeModeContext);

export default ThemeModeProvider;
