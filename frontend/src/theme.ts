import { createTheme } from '@mui/material/styles';

// "Niebo" palette: sky blues with a coral accent for the microphone
export const sky = {
  ink: '#16324D',
  muted: '#5C7892',
  blue: '#2F80ED',
  blueSoft: '#DCEBFF',
  blueTint: '#E8F3FF',
  line: '#D3E6F6',
  coral: '#F43F5E',
  coralLight: '#FF8A94',
  green: '#22A565',
  bgTop: '#BFE2FF',
  bgMid: '#E3F2FF',
  bgBottom: '#F7FBFF',
  side: 'rgba(244, 250, 255, 0.86)',
  softShadow: '0 6px 18px rgba(47, 128, 237, 0.12)',
  bubbleShadow: '0 8px 20px rgba(47, 128, 237, 0.20)',
} as const;

export const skyGradient = `linear-gradient(180deg, ${sky.bgTop} 0%, ${sky.bgMid} 55%, ${sky.bgBottom} 100%)`;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: sky.blue },
    secondary: { main: sky.coral },
    error: { main: '#EF4444' },
    success: { main: sky.green, contrastText: '#fff' },
    info: { main: '#3B82F6' },
    text: { primary: sky.ink, secondary: sky.muted },
    divider: sky.line,
    background: { default: '#EAF5FF', paper: '#FFFFFF' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: [
      '"Nunito Variable"',
      'Nunito',
      'ui-rounded',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 800 },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 800 },
    button: { textTransform: 'none', fontWeight: 800 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: sky.bgMid,
          minHeight: '100dvh',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          color: sky.ink,
          boxShadow: 'none',
          borderBottom: `1px solid ${sky.line}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 14, transition: 'transform .08s ease, box-shadow .2s ease' },
        containedPrimary: { boxShadow: '0 6px 16px rgba(47, 128, 237, 0.28)' },
        containedSuccess: { boxShadow: '0 6px 16px rgba(34, 165, 101, 0.30)' },
        containedError: { boxShadow: '0 6px 16px rgba(239, 68, 68, 0.28)' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 24 },
        paperFullScreen: { borderRadius: 0 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontWeight: 800 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: sky.ink, fontWeight: 700, fontSize: 13, borderRadius: 10 },
        arrow: { color: sky.ink },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'transform .08s ease',
          '&:active': { transform: 'scale(0.96)' },
        },
      },
    },
  },
});
