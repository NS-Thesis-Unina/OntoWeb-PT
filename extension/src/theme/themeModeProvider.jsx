// src/theme/ThemeModeProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createNeutralTheme } from "./themeSetup";
import browser from "webextension-polyfill";

const ThemeModeContext = createContext({
  mode: "dark",
  toggleMode: () => {},
  setMode: (m) => {}
});

export function ThemeModeProvider({ children, defaultMode = "dark" }) {
  const [mode, setModeState] = useState(defaultMode);
  const [muiTheme, setMuiTheme] = useState(() => createNeutralTheme(defaultMode));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const obj = await browser.storage.local.get("ui_theme_mode").catch(() => ({}));
        const saved = obj?.ui_theme_mode ?? null;
        const initial = saved || defaultMode;
        if (!mounted) return;
        setModeState(initial);
        setMuiTheme(createNeutralTheme(initial));
      } catch (e) {
        setModeState(defaultMode);
        setMuiTheme(createNeutralTheme(defaultMode));
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [defaultMode]);

  const setMode = async (nextMode) => {
    const newMode = typeof nextMode === "string" ? nextMode : (mode === "dark" ? "light" : "dark");
    setModeState(newMode);
    setMuiTheme(createNeutralTheme(newMode));
    try {
      await browser.storage.local.set({ ui_theme_mode: newMode }).catch(() => {});
    } catch (e) {
      // ignore
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
