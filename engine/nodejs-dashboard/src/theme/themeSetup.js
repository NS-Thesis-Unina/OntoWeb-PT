import { createTheme } from '@mui/material/styles';

export function createNeutralTheme(mode = 'dark') {
  const isDark = mode === 'dark';

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

  // Base theme configuration
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

  // Second pass to apply component overrides that depend on the computed theme
  theme = createTheme(theme, {
    components: {
      // AppBar: transparent, text inherits from theme
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            color: theme.palette.text.primary,
          },
        },
      },

      // Paper: subtle border and background for cards and surfaces
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        },
      },

      // Card: gradient background with border and rounded corners
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

      // CardActionArea: full-height clickable area
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

      // CardContent: take full width of the card container
      MuiCardContent: {
        styleOverrides: {
          root: {
            width: '100%',
          },
        },
      },

      // Button: smoother corners, neutral gradients for primary variant
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

      // Chip
      MuiChip: {
        styleOverrides: {
          root: {
            '&.httprequestsdatagrid-method-chip': {
              color: isDark ? '#000000' : '#ffffff',
            },
          },
        },
      },

      // Accordion: compact spacing and no pseudo divider line
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

      // AccordionSummary: compact header height and margins
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

      // Tabs & Tab: improved indicator and selected state styling
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

      // Tooltip: themed background, border and shadow
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

      // StepIcon: color text
      MuiStepIcon: {
        styleOverrides: {
          text: {
            fill: theme.palette.mode === 'dark' ? '#000000ff' : '#ffffffff',
          },
        },
      },

      // Divider: use theme's divider color
      MuiDivider: {
        styleOverrides: {
          root: { background: theme.palette.divider },
        },
      },
    },
  });

  return theme;
}

// Pre-built themes for direct use if needed
export const neutralDarkTheme = createNeutralTheme('dark');
export const neutralLightTheme = createNeutralTheme('light');
