import { useCallback, useEffect, useRef, useState } from 'react';
import { api, HistoryItem } from '../api/client';
import { Status } from '../types/status';
import { extractErrorMessage } from '../utils/errors';
import type { Sfx } from './useSfx';

export type ProcessMode = 'full' | 'printOnly' | 'edit';

type PipelineSettings = {
  improveEnabled: boolean;
  landscapeMode: boolean;
  autoPrint: boolean;
};

type PipelineOptions = {
  settings: PipelineSettings;
  sfx: Sfx;
  // A new picture exists (new idea, redraw or correction): refresh history, open it, play the reveal
  onCreated: (id: string) => Promise<void> | void;
  // A print-only job finished
  onPrinted: () => void;
  onHistoryChanged: () => Promise<void> | void;
};

/**
 * Everything that happens after the child asks for a picture:
 * transcribe → improve → find people → draw → print, plus redraw, corrections and printing.
 * One place for the steps, the progress state shown in ProcessingDialog and "try again".
 */
export const useGenerationPipeline = ({ settings, sfx, onCreated, onPrinted, onHistoryChanged }: PipelineOptions) => {
  const [status, setStatus] = useState<Status>('idle');
  const [processMode, setProcessMode] = useState<ProcessMode | null>(null);
  const [prompt, setPrompt] = useState('');
  const [improvedPrompt, setImprovedPrompt] = useState<string | null>(null);
  const [foundReferences, setFoundReferences] = useState<string[] | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [includeTranscribeStep, setIncludeTranscribeStep] = useState(false);
  const [generatingElapsedSeconds, setGeneratingElapsedSeconds] = useState(0);
  // The child may close the progress dialog; the job keeps running in the background
  const [dialogHidden, setDialogHidden] = useState(false);

  // Latest settings/callbacks without re-creating every action
  const optsRef = useRef({ settings, sfx, onCreated, onPrinted, onHistoryChanged });
  optsRef.current = { settings, sfx, onCreated, onPrinted, onHistoryChanged };
  // What "Spróbuj ponownie" repeats – always the step that failed, with the data gathered so far
  const retryRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (status !== 'generating') {
      setGeneratingElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    setGeneratingElapsedSeconds(0);
    const timer = setInterval(() => setGeneratingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const resetIdle = useCallback(() => {
    setStatus('idle');
    setProcessMode(null);
    setDialogHidden(false);
  }, []);

  const finishCreated = async (id: string) => {
    setStatus('done');
    try {
      await optsRef.current.onCreated(id);
    } finally {
      resetIdle();
    }
  };

  // Shared wrapper: prepares the dialog, runs the job, turns any error into the error state
  const runJob = async (mode: ProcessMode, withTranscribe: boolean, job: () => Promise<void>, fallbackError: string) => {
    setProcessMode(mode);
    setIncludeTranscribeStep(withTranscribe);
    setErrorText(null);
    setDialogHidden(false);
    try {
      await job();
    } catch (e) {
      console.error('Pipeline job failed', e);
      setErrorText(extractErrorMessage(e, fallbackError));
      setStatus('error');
      setDialogHidden(false);
      optsRef.current.sfx.error();
    }
  };

  // improve → find people → draw → (print) for a session that already has an idea
  const drawIdea = async (id: string, idea: string) => {
    const { improveEnabled, landscapeMode, autoPrint } = optsRef.current.settings;
    retryRef.current = () => runJob('full', false, () => drawIdea(id, idea), 'Wystąpił błąd podczas rysowania.');
    setPrompt(idea);
    setImprovedPrompt(null);
    setFoundReferences(null);
    setImageUrl(null);
    let finalPrompt = idea;
    if (improveEnabled) {
      setStatus('improving');
      try {
        const { improved } = await api.improve(id, idea);
        setImprovedPrompt(improved);
        finalPrompt = improved;
      } catch (e) {
        console.warn('Improve failed, using the original idea', e);
      }
    }
    setStatus('referencing');
    const { references } = await api.detectReferences(id, finalPrompt);
    const people = Array.isArray(references) && references.length > 0 ? references : undefined;
    setFoundReferences(people || []);
    setStatus('generating');
    const gen = await api.generate(id, finalPrompt, { landscape: landscapeMode, references: people });
    setImageUrl(gen.imageUrl);
    if (autoPrint) {
      setStatus('printing');
      try {
        await api.print(id);
      } catch (e) {
        console.error('Auto print failed', e);
      }
    }
    await finishCreated(id);
  };

  const transcribeAndDraw = async (audio: Blob) => {
    retryRef.current = () => runJob('full', true, () => transcribeAndDraw(audio), 'Wystąpił błąd podczas przetwarzania.');
    setPrompt('');
    setImprovedPrompt(null);
    setFoundReferences(null);
    setStatus('transcribing');
    const { id, prompt: heard } = await api.transcribe(audio);
    if (!heard.trim()) throw new Error('Nie usłyszałem pomysłu. Spróbuj jeszcze raz.');
    await drawIdea(id, heard);
  };

  const correct = async (source: HistoryItem, instruction: string, targetId?: string) => {
    retryRef.current = () => runJob('edit', false, () => correct(source, instruction, targetId), 'Nie udało się poprawić rysunku.');
    setPrompt(instruction);
    setStatus('generating');
    const result = await api.edit(source.id, instruction, targetId);
    setImageUrl(result.imageUrl);
    setFoundReferences(result.references);
    await finishCreated(result.id);
  };

  const transcribeAndCorrect = async (source: HistoryItem, audio: Blob) => {
    retryRef.current = () => runJob('edit', true, () => transcribeAndCorrect(source, audio), 'Nie udało się poprawić rysunku.');
    setPrompt('');
    setStatus('transcribing');
    const { id, prompt: heard } = await api.transcribe(audio);
    if (!heard.trim()) throw new Error('Nie usłyszałem, co zmienić. Spróbuj jeszcze raz.');
    await correct(source, heard.trim(), id);
  };

  const redrawItem = async (item: HistoryItem) => {
    retryRef.current = () => runJob('full', false, () => redrawItem(item), 'Nie udało się narysować jeszcze raz.');
    const description = item.improvedPrompt || item.prompt;
    setPrompt(item.prompt);
    setImprovedPrompt(item.improvedPrompt || null);
    setFoundReferences(Array.isArray(item.references) ? item.references : null);
    setStatus('generating');
    const id = String(Date.now());
    const gen = await api.generate(id, description, {
      landscape: optsRef.current.settings.landscapeMode,
      references: item.references?.length ? item.references : undefined,
      originalPrompt: item.improvedPrompt ? item.prompt : undefined,
    });
    setImageUrl(gen.imageUrl);
    await finishCreated(id);
  };

  const printItem = async (item: HistoryItem) => {
    retryRef.current = () => runJob('printOnly', false, () => printItem(item), 'Nie udało się wydrukować.');
    setStatus('printing');
    await api.print(item.id);
    setStatus('done');
    optsRef.current.onPrinted();
    await optsRef.current.onHistoryChanged();
    resetIdle();
  };

  return {
    // state for ProcessingDialog
    status,
    processMode,
    prompt,
    improvedPrompt,
    foundReferences,
    imageUrl,
    errorText,
    includeTranscribeStep,
    generatingElapsedSeconds,
    dialogOpen: status !== 'idle' && status !== 'recording' && !dialogHidden,
    canStart: status === 'idle' || status === 'error' || status === 'done',

    // recording is driven by the microphone hook; the pipeline only shows it
    setRecording: (recording: boolean) => (recording ? setStatus('recording') : resetIdle()),
    fail: (message: string) => {
      retryRef.current = null; // nothing to repeat (e.g. no microphone) – "try again" just closes
      setProcessMode(null);
      setErrorText(message);
      setStatus('error');
      setDialogHidden(false);
      optsRef.current.sfx.error();
    },

    fromIdea: (idea: string) => runJob('full', false, () => drawIdea(String(Date.now()), idea), 'Wystąpił błąd podczas rysowania.'),
    fromAudio: (audio: Blob) => runJob('full', true, () => transcribeAndDraw(audio), 'Wystąpił błąd podczas przetwarzania.'),
    redraw: (item: HistoryItem) => runJob('full', false, () => redrawItem(item), 'Nie udało się narysować jeszcze raz.'),
    correctWithText: (source: HistoryItem, text: string) =>
      runJob('edit', false, () => correct(source, text.trim()), 'Nie udało się poprawić rysunku.'),
    correctWithAudio: (source: HistoryItem, audio: Blob) =>
      runJob('edit', true, () => transcribeAndCorrect(source, audio), 'Nie udało się poprawić rysunku.'),
    print: (item: HistoryItem) => runJob('printOnly', false, () => printItem(item), 'Nie udało się wydrukować.'),
    retry: () => (retryRef.current ? retryRef.current() : resetIdle()),

    // Close the dialog: after an error go back to idle, while working keep going in the background
    closeDialog: () => {
      if (status === 'error' || status === 'done') resetIdle();
      else setDialogHidden(true);
    },
  };
};

export type GenerationPipeline = ReturnType<typeof useGenerationPipeline>;
