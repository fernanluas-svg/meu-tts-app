import { useState, useCallback, useEffect, useRef } from 'react';
import { generateSpeech, TTSOptions } from '../services/geminiService';
import { TtsSegment, saveSegment, getSegments, clearSegments, cacheAudio, getCachedAudio } from '../lib/db';
import { splitTextIntoChunks, combineWavBlobs } from '../lib/audioUtils';

interface QueueState {
  isProcessing: boolean;
  isPreviewing: boolean;
  segments: TtsSegment[];
  currentId: string | null;
  logs: string[];
  totalProgress: number;
  finalAudioUrl: string | null;
  error: string | null;
}

export function useTTSQueue() {
  const [state, setState] = useState<QueueState>({
    isProcessing: false,
    isPreviewing: false,
    segments: [],
    currentId: null,
    logs: [],
    totalProgress: 0,
    finalAudioUrl: null,
    error: null,
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const addLog = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      logs: [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.logs].slice(0, 50)
    }));
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      const saved = await getSegments();
      if (saved.length > 0) {
        addLog(`Sessão restaurada: ${saved.length} segmentos carregados.`);
        const completed = saved.filter(s => s.status === 'completed').length;
        setState(prev => ({
          ...prev,
          segments: saved,
          totalProgress: (completed / saved.length) * 100
        }));
      }
    };
    restore();
  }, [addLog]);

  const previewVoice = useCallback(async (voiceId: string, previewText: string) => {
    if (stateRef.current.isProcessing || stateRef.current.isPreviewing) return null;
    
    setState(prev => ({ ...prev, isPreviewing: true, error: null }));
    addLog(`Iniciando teste de voz: ${voiceId}`);

    try {
      const cacheKey = `preview_${voiceId}_${previewText}`;
      let audioBlob = await getCachedAudio(cacheKey);

      if (!audioBlob) {
        const buffer = await generateSpeech({ 
          voiceId, 
          text: previewText, 
          speed: 1.0, 
          pitch: 0 
        });
        audioBlob = new Blob([buffer], { type: 'audio/wav' });
        await cacheAudio(cacheKey, audioBlob);
      }

      const url = URL.createObjectURL(audioBlob);
      setState(prev => ({ ...prev, isPreviewing: false }));
      addLog(`Teste de voz "${voiceId}" pronto.`);
      return url;
    } catch (err) {
      addLog(`Erro no teste de voz: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setState(prev => ({ ...prev, isPreviewing: false, error: "Falha ao testar voz." }));
      return null;
    }
  }, [addLog]);

  const processQueue = useCallback(async (options: Omit<TTSOptions, 'text'>) => {
    const { segments, isProcessing } = stateRef.current;
    if (isProcessing) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    addLog("Iniciando processamento da fila...");

    let errorCount = 0;
    const MAX_RETRIES = 3;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.status === 'completed') continue;

      setState(prev => ({ ...prev, currentId: segment.id }));
      addLog(`Processando segmento ${i + 1}/${segments.length}: "${segment.text.slice(0, 30)}..."`);

      let retryDelay = 2000;
      let success = false;

      while (!success && errorCount < MAX_RETRIES) {
        try {
          // Check Cache
          const cacheKey = `${segment.text}_${options.voiceId}_${options.speed}_${options.pitch}`;
          let audioBlob = await getCachedAudio(cacheKey);

          if (!audioBlob) {
            const buffer = await generateSpeech({ ...options, text: segment.text });
            audioBlob = new Blob([buffer], { type: 'audio/wav' });
            await cacheAudio(cacheKey, audioBlob);
            addLog(`Segmento ${i + 1} gerado com sucesso.`);
          } else {
            addLog(`Segmento ${i + 1} recuperado do cache.`);
          }

          const updatedSegment: TtsSegment = { 
            ...segment, 
            status: 'completed', 
            audioBlob 
          };
          
          await saveSegment(updatedSegment);
          
          setState(prev => {
            const newSegments = [...prev.segments];
            newSegments[i] = updatedSegment;
            const completedCount = newSegments.filter(s => s.status === 'completed').length;
            return {
              ...prev,
              segments: newSegments,
              totalProgress: (completedCount / newSegments.length) * 100
            };
          });

          success = true;
          errorCount = 0; // reset error count on success
          
          // Adaptive delay between requests to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (err) {
          errorCount++;
          addLog(`Erro no segmento ${i + 1} (Tentativa ${errorCount}/${MAX_RETRIES}): ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
          
          if (errorCount >= MAX_RETRIES) {
             setState(prev => ({ ...prev, isProcessing: false, error: "Falha após múltiplas tentativas. Verifique sua conexão ou limite da API." }));
             return;
          }
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2;
        }
      }
    }

    addLog("Todos os segmentos processados. Unindo arquivos...");
    
    // Join Blobs
    try {
      const allSegments = await getSegments();
      const blobs = allSegments.map(s => s.audioBlob).filter((b): b is Blob => !!b);
      const finalBlob = await combineWavBlobs(blobs);
      const url = URL.createObjectURL(finalBlob);
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        currentId: null,
        finalAudioUrl: url,
        totalProgress: 100
      }));
      addLog("Áudio final gerado com sucesso!");
    } catch (err) {
      addLog(`Erro ao unir áudios: ${err}`);
      setState(prev => ({ ...prev, isProcessing: false, error: "Erro ao finalizar o arquivo de áudio." }));
    }

  }, [addLog]);

  const startNewSession = useCallback(async (text: string, options: Omit<TTSOptions, 'text'>) => {
    if (stateRef.current.isProcessing) return;

    addLog("Preparando novo texto...");
    await clearSegments();
    
    const chunks = splitTextIntoChunks(text);
    const newSegments: TtsSegment[] = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      text: chunk,
      status: 'pending',
      index
    }));

    for (const seg of newSegments) {
      await saveSegment(seg);
    }

    setState(prev => ({
      ...prev,
      segments: newSegments,
      totalProgress: 0,
      finalAudioUrl: null,
      error: null,
      logs: [`[${new Date().toLocaleTimeString()}] Texto dividido em ${chunks.length} segmentos.`, ...prev.logs]
    }));

    // Trigger processing
    setTimeout(() => processQueue(options), 100);
  }, [addLog, processQueue]);

  const resetAll = useCallback(async () => {
    await clearSegments();
    setState({
      isProcessing: false,
      isPreviewing: false,
      segments: [],
      currentId: null,
      logs: [],
      totalProgress: 0,
      finalAudioUrl: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    startNewSession,
    previewVoice,
    resetAll,
  };
}
