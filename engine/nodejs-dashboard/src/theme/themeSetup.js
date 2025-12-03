/**
 * Theme Setup
 *
 * Central factory for Material UI theme creation. Produces a neutral,
 * low-contrast visual identity tuned for both dark and light modes.
 *
 * Exports:
 * - createNeutralTheme(mode): returns a fully configured MUI theme.
 * - neutralDarkTheme / neutralLightTheme: ready-to-use presets.
 *
 * Design Notes:
 * - Palette values are intentionally restrained to reduce visual noise.
 * - Theme is built in two passes:
 *   1) Base theme with palette/typography/shape.
 *   2) Component overrides that depend on computed theme tokens.
 */

import { createTheme } from '@mui/material/styles';

/**
 * Create a neutral MUI theme for the given color mode.
 *
 * @param {'light'|'dark'} [mode='dark'] - Preferred color scheme.
 * @returns {import('@mui/material').Theme} A Material UI theme instance.
 */
export function createNeutralTheme(mode = 'dark') {
  const isDark = mode === 'dark';

  // --- Palette: neutral greys + minimal primary for focus/selection ---
  const palette = {
    mode,
    common: { black: '#000000', white: '#ffffff' },
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    primary: {
      main: isDark ? '#e6e6e6' : '#212121',
      contrastText: isDark ? '#ffffff' : '#0b0b0b',
    },
    background: {
      default: isDark ? '#0b0b0b' : '#ffffff',
      paper: isDark ? '#0f0f0f' : '#f7f7f7',
    },
    text: {
      primary: isDark ? '#f3f3f3' : '#0b0b0b',
      secondary: isDark ? '#cfcfcf' : '#4f4f4f',
    },
    divider: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
    action: {
      hover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      selected: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      disabled: isDark ? 'rgba(255, 255, 255, 0.36)' : 'rgba(0,0,0,0.38)',
    },
  };

  // --- Pass 1: base theme tokens (used by overrides in Pass 2) ---
  let theme = createTheme({
    palette,
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      h1: { fontSize: '1.25rem', fontWeight: 700 },
      h2: { fontSize: '1.05rem', fontWeight: 700 },
      h6: {
        color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
      },
      body1: { fontSize: 14 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*, *::before, *::after': { boxSizing: 'border-box' },
          html: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
        },
      },
    },
  });

  // --- Pass 2: component-level overrides that depend on resolved tokens ---
  theme = createTheme(theme, {
    components: {
      // AppBar: transparent shell; inherits text color from theme
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            color: theme.palette.text.primary,
          },
        },
      },

      // Paper: card/surface with subtle border for separation
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        },
      },

      // Card: soft gradient and rounded corners
      MuiCard: {
        styleOverrides: {
          root: {
            background:
              theme.palette.mode === 'dark'
                ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))'
                : 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.01))',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
          },
        },
      },

      // CardActionArea: expand clickable area to the full card height
      MuiCardActionArea: {
        styleOverrides: {
          root: {
            '&&': {
              display: 'flex',
              alignItems: 'baseline',
              height: '100%',
            },
          },
        },
      },

      // CardContent: take full width within the card container
      MuiCardContent: {
        styleOverrides: {
          root: {
            width: '100%',
          },
        },
      },

      // Button: neutral styling, rounded corners; primary uses a subtle gradient
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
          },
          containedPrimary: {
            background:
              theme.palette.mode === 'dark'
                ? `linear-gradient(180deg, ${theme.palette.grey[700]}, ${theme.palette.grey[900]})`
                : `linear-gradient(180deg, ${theme.palette.grey[100]}, ${theme.palette.grey[200]})`,
            color: theme.palette.primary.contrastText,
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
          },
          outlined: {
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          },
        },
      },

      // Accordion: compact spacing; remove default top divider
      MuiAccordion: {
        styleOverrides: {
          root: {
            '&.Mui-expanded': {
              margin: 0,
              minHeight: 0,
              marginBottom: '10px',
            },
            '&.Mui-expanded:last-of-type': {
              marginBottom: '10px',
            },
            '&::before': { display: 'none' },
          },
        },
      },

      // AccordionSummary: smaller header density
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            minHeight: 0,
            '&.Mui-expanded': { minHeight: 0, margin: 0 },
          },
          content: {
            '&.Mui-expanded': { margin: '10px 0' },
          },
        },
      },

      // Tabs & Tab: thicker indicator and clear selected state
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.primary.main,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            minWidth: 90,
            '&.Mui-selected': { color: theme.palette.primary.main },
          },
        },
      },

      // Tooltip: themed surface with border and shadow
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[3],
            fontSize: 12,
          },
        },
      },

      // StepIcon: ensure text contrast inside the icon
      MuiStepIcon: {
        styleOverrides: {
          text: {
            fill: theme.palette.mode === 'dark' ? '#000000ff' : '#ffffffff',
          },
        },
      },

      // Divider: use theme's divider token for consistency
      MuiDivider: {
        styleOverrides: {
          root: { background: theme.palette.divider },
        },
      },
    },
  });

  return theme;
}

// Pre-built themes for direct consumption if needed
export const neutralDarkTheme = createNeutralTheme('dark');
export const neutralLightTheme = createNeutralTheme('light');
