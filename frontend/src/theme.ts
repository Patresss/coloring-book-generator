import { createTheme } from '@mui/material/styles';

const AMBER = '#FFB703';
const ORANGE = '#FB8500';

export const theme = createTheme({
  palette: {
    mode: 'light',
    // vibrant, kid-friendly palette (no purple)
    primary: { main: ORANGE },
    secondary: { main: '#00B4D8' },
    error: { main: '#EF476F' },
    success: { main: '#34D399' },
    info: { main: '#60A5FA' },
    background: { default: '#FFFDF6', paper: '#FFFFFF' },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#FFFDF6',
          // Softer, less saturated ambient wash
          backgroundImage: 'radial-gradient(60% 100% at 100% 0%, rgba(255, 183, 3, 0.06) 0%, rgba(255, 183, 3, 0) 60%), radial-gradient(50% 60% at 0% 100%, rgba(96, 165, 250, 0.05) 0%, rgba(96, 165, 250, 0) 60%)',
          minHeight: '100dvh',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: `linear-gradient(90deg, ${AMBER} 0%, ${ORANGE} 100%)`,
          backgroundColor: 'transparent',
          color: '#fff',
          boxShadow: '0 6px 24px rgba(251, 133, 0, 0.25)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        colorError: {
          backgroundImage: 'linear-gradient(135deg, #FF4D6D 0%, #EF476F 100%)',
          color: '#fff',
          '&:hover': {
            filter: 'brightness(0.95)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 14, transition: 'transform .08s ease, box-shadow .2s ease' },
        containedPrimary: { boxShadow: '0 6px 16px rgba(251, 133, 0, 0.3)' },
        containedSuccess: { boxShadow: '0 6px 16px rgba(52, 211, 153, 0.35)' },
        containedInfo: { boxShadow: '0 6px 16px rgba(96, 165, 250, 0.35)' },
        containedError: { boxShadow: '0 6px 16px rgba(239, 71, 111, 0.35)' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
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
