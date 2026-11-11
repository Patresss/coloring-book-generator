import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HearingRoundedIcon from '@mui/icons-material/HearingRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { keyframes } from '@mui/system';
import { Status } from '../types/status';
import { sky } from '../theme';
import { PeopleChips } from './PeopleChips';

type ProcessingDialogProps = {
  open: boolean;
  status: Status;
  processMode: 'full' | 'printOnly' | null;
  prompt: string;
  improveEnabled: boolean;
  improvedPrompt: string | null;
  foundReferences: string[] | null;
  imageUrl: string | null;
  errorText: string | null;
  autoPrint: boolean;
  includeTranscribeStep: boolean;
  generatingElapsedSeconds: number;
  isMobile: boolean;
  onClose: () => void;
  onRetry: () => void;
};

type StepKey = 'transcribing' | 'improving' | 'referencing' | 'generating' | 'printing';

const STEP_INFO: Record<StepKey, { label: string; title: string; icon: React.ReactNode }> = {
  transcribing: { label: 'Słucham', title: 'Słucham, co powiedziałeś…', icon: <HearingRoundedIcon /> },
  improving: { label: 'Dodaję szczegóły', title: 'Dodaję szczegóły…', icon: <AutoAwesomeRoundedIcon /> },
  referencing: { label: 'Szukam osób', title: 'Sprawdzam, kogo narysować…', icon: <GroupsRoundedIcon /> },
  generating: { label: 'Rysuję', title: 'Rysuję…', icon: <BrushRoundedIcon /> },
  printing: { label: 'Drukuję', title: 'Drukuję…', icon: <PrintRoundedIcon /> },
};

const getSteps = (
  processMode: 'full' | 'printOnly' | null,
  includeTranscribeStep: boolean,
  improveEnabled: boolean,
  autoPrint: boolean,
): StepKey[] => {
  if (processMode === 'printOnly') return ['printing'];
  const steps: StepKey[] = [];
  if (includeTranscribeStep) steps.push('transcribing');
  if (improveEnabled) steps.push('improving');
  steps.push('referencing', 'generating');
  if (autoPrint) steps.push('printing');
  return steps;
};

const CRAYONS = ['#F43F5E', '#FB923C', '#22A565', '#2F80ED', '#8B5CF6', '#16324D'];

const crayonBounce = keyframes`
  0%, 100% { transform: scaleY(1) translateY(0); }
  50% { transform: scaleY(1.15) translateY(-8px); }
`;
const slide = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(260%); }
`;
const stepPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(47, 128, 237, 0.45); }
  100% { box-shadow: 0 0 0 10px rgba(47, 128, 237, 0); }
`;
const noMotion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

const detailBox = {
  p: 1.25,
  bgcolor: sky.blueTint,
  borderRadius: '12px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 14,
} as const;

export const ProcessingDialog: React.FC<ProcessingDialogProps> = ({
  open,
  status,
  processMode,
  prompt,
  improveEnabled,
  improvedPrompt,
  foundReferences,
  imageUrl,
  errorText,
  autoPrint,
  includeTranscribeStep,
  generatingElapsedSeconds,
  onClose,
  onRetry,
}) => {
  const steps = React.useMemo(
    () => getSteps(processMode, includeTranscribeStep, improveEnabled, autoPrint),
    [processMode, includeTranscribeStep, improveEnabled, autoPrint],
  );

  // Remember the last running step so an error can point at it
  const lastStepRef = React.useRef<StepKey | null>(null);
  const running = (steps as string[]).includes(status);
  if (running) lastStepRef.current = status as StepKey;
  if (!open) lastStepRef.current = null;

  const isError = status === 'error';
  const isDone = status === 'done';
  const currentStep = running ? (status as StepKey) : lastStepRef.current;
  const activeIndex = isDone ? steps.length : currentStep ? steps.indexOf(currentStep) : -1;

  const title = isError
    ? 'Ups, coś poszło nie tak'
    : isDone
      ? 'Gotowe!'
      : currentStep
        ? STEP_INFO[currentStep].title
        : 'Chwileczkę…';

  const showPromptDetails = Boolean(prompt) && processMode !== 'printOnly';

  // Detect if error is from Google/Gemini
  const isGoogleError = errorText && (
    errorText.includes('niespójnego polecenia') ||
    errorText.includes('Gemini') ||
    errorText.includes('Google') ||
    errorText.includes('moderation') ||
    errorText.includes('safety')
  );
  const displayErrorText = isGoogleError && errorText
    ? `Błąd po stronie Google: ${errorText}`
    : (errorText || 'Wystąpił błąd. Spróbuj ponownie.');

  return (
    <Dialog onClose={onClose} open={open} fullWidth maxWidth="xs" aria-labelledby="processing-title">
      <DialogContent sx={{ pt: 3.5, pb: 1, textAlign: 'center' }}>
        {running && (
          <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 1, height: 64, mb: 2 }}>
            {CRAYONS.map((color, i) => (
              <Box
                key={color}
                sx={{
                  width: 9,
                  height: 46,
                  background: `linear-gradient(to bottom, ${color} 0%, ${color} 70%, #FFF 70%, #FFF 76%, ${color} 76%)`,
                  borderRadius: '3px 3px 0 0',
                  transformOrigin: 'bottom',
                  animation: `${crayonBounce} 1.2s ease-in-out ${i * 0.12}s infinite`,
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    bottom: -7,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderLeft: '4.5px solid transparent',
                    borderRight: '4.5px solid transparent',
                    borderTop: `7px solid ${color}`,
                  },
                  ...noMotion,
                }}
              />
            ))}
          </Box>
        )}

        <Typography id="processing-title" component="h2" role="status" aria-live="polite" sx={{ fontWeight: 800, fontSize: { xs: 24, sm: 28 }, lineHeight: 1.2 }}>
          {title}
        </Typography>
        {showPromptDetails && (
          <Typography sx={{ mt: 1, color: sky.muted, fontWeight: 700, fontSize: 16, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            „{prompt}”
          </Typography>
        )}
        {showPromptDetails && foundReferences && foundReferences.length > 0 && (
          <Box sx={{ mt: 1.75 }}>
            <PeopleChips references={foundReferences} />
          </Box>
        )}

        <Box component="ol" sx={{ listStyle: 'none', display: 'flex', justifyContent: 'center', gap: { xs: 1, sm: 1.5 }, p: 0, mt: 3, mb: 2 }}>
          {steps.map((key, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex && !isDone;
            const failed = active && isError;
            return (
              <Tooltip key={key} title={STEP_INFO[key].label} arrow>
                <Box
                  component="li"
                  aria-label={`${STEP_INFO[key].label}${done ? ' – gotowe' : failed ? ' – błąd' : active ? ' – w toku' : ''}`}
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: done || active ? '#fff' : sky.muted,
                    bgcolor: failed ? 'error.main' : done ? sky.green : active ? sky.blue : sky.blueTint,
                    animation: active && !failed ? `${stepPulse} 1.3s ease-out infinite` : 'none',
                    transition: 'background-color .3s ease, color .3s ease',
                    '& svg': { fontSize: 24 },
                    ...noMotion,
                  }}
                >
                  {failed ? <PriorityHighRoundedIcon /> : done ? <CheckRoundedIcon /> : STEP_INFO[key].icon}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {running && (
          <>
            <Box sx={{ height: 6, bgcolor: sky.blueTint, borderRadius: 999, overflow: 'hidden' }}>
              <Box sx={{ width: '40%', height: '100%', background: `linear-gradient(90deg, ${sky.blue}, #7FB6FF)`, borderRadius: 999, animation: `${slide} 1.6s ease-in-out infinite`, ...noMotion }} />
            </Box>
            <Typography sx={{ mt: 1.5, color: sky.muted, fontSize: 14, fontWeight: 600, minHeight: '1.5em' }}>
              {status === 'generating' ? `Rysowanie trwa zwykle około minuty · ${generatingElapsedSeconds} s` : ' '}
            </Typography>
          </>
        )}

        {isDone && imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt="Gotowy rysunek"
            sx={{ display: 'block', width: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '14px', border: `1px solid ${sky.line}`, mt: 1 }}
          />
        )}

        {isError && (
          <Box sx={{ mt: 1, textAlign: 'left' }}>
            <Alert severity="error" sx={{ borderRadius: '14px' }}>{displayErrorText}</Alert>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" size="large" startIcon={<RefreshRoundedIcon />} onClick={onRetry} sx={{ minWidth: 220, borderRadius: 999 }}>
                Spróbuj ponownie
              </Button>
            </Box>
          </Box>
        )}

        {showPromptDetails && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{ mt: 1.5, textAlign: 'left', bgcolor: 'transparent', '&::before': { display: 'none' } }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRoundedIcon />}
              sx={{ px: 1, minHeight: 40, color: sky.muted, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Szczegóły dla rodzica</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1, pt: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Pomysł</Typography>
                <Box sx={detailBox}>{prompt}</Box>
              </Box>
              {improveEnabled && improvedPrompt != null && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Ulepszony opis</Typography>
                  <Box sx={detailBox}>{improvedPrompt}</Box>
                </Box>
              )}
              {foundReferences != null && foundReferences.length === 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Osoby z rodziny</Typography>
                  <Box sx={detailBox}>Nie znaleziono nikogo z folderu referencji</Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ color: sky.muted, borderRadius: 999, px: 3 }}>
          Zamknij
        </Button>
      </DialogActions>
    </Dialog>
  );
};
