import { useCallback, useRef } from 'react';

// Thin wrapper around MediaRecorder: start() asks for the microphone, the blob arrives in onFinished.
export const useRecorder = () => {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);

  const releaseStream = (recorder: MediaRecorder | null) => {
    recorder?.stream.getTracks().forEach((track) => track.stop());
  };

  const start = useCallback(async (onFinished: (audio: Blob) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : undefined; // Safari records mp4/aac
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    cancelledRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      releaseStream(recorder);
      recorderRef.current = null;
      if (cancelledRef.current) return;
      onFinished(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
    };
    recorderRef.current = recorder;
    recorder.start();
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.stop();
    else releaseStream(recorder);
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  return { start, stop, cancel };
};
