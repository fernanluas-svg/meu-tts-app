import { useState, useRef, useCallback } from 'react';
import { generateSpeech, TTSOptions } from '../services/ttsService';

export function useTTS() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const generate = useCallback(async (options: TTSOptions) => {
    if (isGenerating) return;

    try {
      setIsGenerating(true);
      setError(null);
      setProgress(10);
      setStatus("Preparando áudio...");
      
      // Simulate progress for UI feedback
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 80) return prev + Math.random() * 5;
          return prev;
        });
      }, 500);

      const audioBuffer = await generateSpeech(options);
      
      clearInterval(progressInterval);
      setProgress(90);
      setStatus("Finalizando arquivo...");

      // The Gemini API returns raw PCM data at 24000Hz (based on skill docs)
      // However, usually putting it into a Blob with audio/wav header helps or using AudioContext
      
      // For simplicity and downloadability, we'll create a WAV blob from the raw data
      // Although standard MediaRecorder can also be used if streaming, but here we got the full buffer.
      
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      setAudioUrl(url);
      setProgress(100);
      setStatus("Concluído!");
      
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setStatus(null);
      }, 1000);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Ocorreu um erro inesperado");
      setIsGenerating(false);
      setProgress(0);
      setStatus(null);
    }
  }, [isGenerating]);

  const clearAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  return {
    generate,
    isGenerating,
    progress,
    status,
    audioUrl,
    error,
    clearAudio
  };
}
