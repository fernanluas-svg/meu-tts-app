import { VOICES } from '../constants';

export const XTTS_API_URL = 'http://127.0.0.1:8000';

export interface TTSOptions {
  text: string;
  voiceId: string;
  speed: number;
  pitch: number;
}

export function resolveVoiceName(voiceId: string): string {
  const voice = VOICES.find(v => v.id === voiceId);
  return voice ? voice.name : voiceId;
}

function serverError(status: number, detail: unknown): Error {
  const suffix = typeof detail === 'string' && detail ? ` — ${detail}` : '';
  return new Error(`Erro na API XTTS local (HTTP ${status})${suffix}`);
}

async function requestJson(url: string, body?: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor XTTS local. Verifique se ele está rodando em http://127.0.0.1:8000.'
    );
  }
  return response;
}

export async function generateSpeech({ text, voiceId, speed }: TTSOptions): Promise<ArrayBuffer> {
  const voice = resolveVoiceName(voiceId);

  const response = await requestJson(`${XTTS_API_URL}/api/tts`, {
    text,
    voice,
    speed,
    temperature: 0.75,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = typeof payload.detail === 'string' ? payload.detail : '';
    } catch {
      /* ignore */
    }
    throw serverError(response.status, detail);
  }

  return response.arrayBuffer();
}

export async function fetchVoicePreview(voiceId: string): Promise<ArrayBuffer> {
  const voice = resolveVoiceName(voiceId);

  const response = await requestJson(`${XTTS_API_URL}/api/preview/${encodeURIComponent(voice)}`);

  if (!response.ok) {
    throw serverError(response.status, 'Voz de preview não encontrada.');
  }

  return response.arrayBuffer();
}