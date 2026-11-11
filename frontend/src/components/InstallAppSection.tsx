import React from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobileRounded';
import { usePwaInstall } from '../pwa';
import { sky } from '../theme';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Settings section that installs the app on a tablet/phone home screen
export const InstallAppSection: React.FC = () => {
  const { canInstall, installed, secure, install } = usePwaInstall();
  const [done, setDone] = React.useState(false);

  const onInstall = async () => {
    const accepted = await install();
    if (accepted) setDone(true);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>Aplikacja na tablecie</Typography>
          <Typography variant="caption" color="text.secondary">
            Ikona na ekranie głównym, pełny ekran bez paska przeglądarki.
          </Typography>
        </Box>
        {installed || done ? (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'success.main', flex: 'none', fontWeight: 800 }}>
            <CheckCircleRoundedIcon fontSize="small" />
            <span>Zainstalowana</span>
          </Stack>
        ) : canInstall ? (
          <Button variant="contained" startIcon={<InstallMobileRoundedIcon />} onClick={onInstall} sx={{ borderRadius: 999, flex: 'none' }}>
            Zainstaluj
          </Button>
        ) : null}
      </Stack>

      {!installed && !done && !canInstall && (
        <Box sx={{ mt: 1.25, p: 1.5, borderRadius: '12px', bgcolor: sky.blueTint, fontSize: 14, lineHeight: 1.5 }}>
          {!secure ? (
            <Alert severity="warning" sx={{ borderRadius: '10px' }}>
              Instalacja działa tylko przez <b>https://</b>. Teraz aplikacja jest otwarta przez zwykłe http, więc przeglądarka
              nie pozwoli jej zainstalować. Ustaw na Synology odwrotne proxy z certyfikatem (Panel sterowania → Portal logowania →
              Zaawansowane → Odwrotne proxy) i otwórz aplikację pod adresem https.
            </Alert>
          ) : isIOS() ? (
            <>W Safari naciśnij <b>Udostępnij</b> (kwadrat ze strzałką), a potem <b>„Do ekranu początkowego”</b>.</>
          ) : (
            <>
              W Chrome otwórz menu <b>⋮</b> (prawy górny róg) i wybierz <b>„Zainstaluj aplikację”</b> albo
              <b> „Dodaj do ekranu głównego”</b>. Jeśli tej opcji nie ma, odśwież stronę i spróbuj ponownie.
            </>
          )}
        </Box>
      )}
    </Box>
  );
};
