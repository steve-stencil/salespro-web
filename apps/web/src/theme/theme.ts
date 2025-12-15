/**
 * MUI Theme configuration with Leap brand design tokens.
 * Colors and typography sourced from Confluence Design Tokens page.
 * @see https://leap.atlassian.net/wiki/spaces/PROD/pages/38141995/Color+Tokens
 * @see https://leap.atlassian.net/wiki/spaces/PROD/pages/41123934/Typography+Tokens
 */
import { createTheme } from '@mui/material/styles';

import type { ThemeOptions } from '@mui/material/styles';

/**
 * Leap brand color tokens - Light mode.
 */
const leapColorsLight = {
  primary: {
    main: '#26D07C',
    dark: '#1FBC6F',
    light: '#76E4AE',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#4779FF',
    dark: '#3862D2',
    light: '#789DFF',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#F1001F',
    dark: '#C8001A',
    light: '#F55469',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#ED6C02',
    dark: '#E65100',
    light: '#FF9800',
    contrastText: '#FFFFFF',
  },
  info: {
    main: '#4779FF',
    dark: '#3862D2',
    light: '#789DFF',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#26D07C',
    dark: '#1FBC6F',
    light: '#76E4AE',
    contrastText: '#FFFFFF',
  },
};

/**
 * Leap brand color tokens - Dark mode.
 */
const leapColorsDark = {
  primary: {
    main: '#63D98B',
    dark: '#26D07C',
    light: '#93E5BD',
    contrastText: '#2E2E2E',
  },
  secondary: {
    main: '#6C94FF',
    dark: '#4779FF',
    light: '#AAC1FF',
    contrastText: '#2E2E2E',
  },
  error: {
    main: '#F53951',
    dark: '#F1001F',
    light: '#EE7A89',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#FFA726',
    dark: '#F57C00',
    light: '#FFB74D',
    contrastText: '#2E2E2E',
  },
  info: {
    main: '#6C94FF',
    dark: '#4779FF',
    light: '#AAC1FF',
    contrastText: '#2E2E2E',
  },
  success: {
    main: '#63D98B',
    dark: '#26D07C',
    light: '#93E5BD',
    contrastText: '#2E2E2E',
  },
};

/**
 * Leap typography tokens.
 * Primary: Poppins (headlines, buttons, navigation)
 * Secondary: Arial (body copy, inputs)
 */
const typography: ThemeOptions['typography'] = {
  fontFamily: "'Poppins', Arial, sans-serif",
  h1: {
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 600,
    fontSize: '4.375rem', // 70px
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 700,
    fontSize: '1.5rem', // 24px
    lineHeight: 1.3,
  },
  h3: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 700,
    fontSize: '1rem', // 16px
    lineHeight: 1.4,
  },
  h4: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 700,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.4,
  },
  h5: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 400,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.4,
  },
  h6: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 500,
    fontSize: '0.75rem', // 12px
    lineHeight: 1.4,
  },
  subtitle1: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 700,
    fontSize: '1rem', // 16px
  },
  subtitle2: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 700,
    fontSize: '0.875rem', // 14px
  },
  body1: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 400,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.5,
  },
  body2: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 400,
    fontSize: '0.75rem', // 12px
    lineHeight: 1.5,
  },
  button: {
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 700,
    fontSize: '0.875rem', // 14px
    textTransform: 'none',
  },
  caption: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 400,
    fontSize: '0.75rem', // 12px
  },
  overline: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 400,
    fontSize: '0.625rem', // 10px
    textTransform: 'uppercase',
  },
};

/**
 * Shared component overrides for consistent styling.
 */
function getComponentOverrides(mode: 'light' | 'dark') {
  return {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '0.75rem 1.5rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: mode === 'light' ? '#1FBC6F' : '#26D07C',
          },
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow:
            mode === 'light'
              ? '0 4px 20px rgba(0, 0, 0, 0.08)'
              : '0 4px 20px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: 'Arial, sans-serif',
          fontSize: '0.75rem',
        },
      },
    },
    MuiLink: {
      defaultProps: {
        underline: 'hover',
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
        },
      },
    },
  } as const;
}

/**
 * Light theme with Leap brand tokens.
 */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    ...leapColorsLight,
    text: {
      primary: '#2E2E2E',
      secondary: 'rgba(46, 46, 46, 0.6)',
      disabled: 'rgba(46, 46, 46, 0.3)',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    divider: 'rgba(46, 46, 46, 0.12)',
    action: {
      active: 'rgba(46, 46, 46, 0.54)',
      hover: 'rgba(46, 46, 46, 0.04)',
      selected: 'rgba(46, 46, 46, 0.08)',
      disabled: 'rgba(46, 46, 46, 0.26)',
      disabledBackground: 'rgba(46, 46, 46, 0.12)',
      focus: 'rgba(46, 46, 46, 0.12)',
    },
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: getComponentOverrides('light'),
});

/**
 * Dark theme with Leap brand tokens.
 */
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    ...leapColorsDark,
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
    background: {
      default: '#1A1A1A',
      paper: '#2E2E2E',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    action: {
      active: 'rgba(255, 255, 255, 0.56)',
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
      focus: 'rgba(255, 255, 255, 0.12)',
    },
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: getComponentOverrides('dark'),
});
