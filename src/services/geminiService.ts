import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("GEMINI_API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

export interface TTSOptions {
  text: string;
  voiceId: string;
  speed: number;
  pitch: number;
}

export async function generateSpeech({ text, voiceId, speed, pitch }: TTSOptions): Promise<ArrayBuffer> {
  if (!API_KEY) throw new Error("API Key não configurada");

  try {
    // Note: Pitch e Speed podem ser injetados no prompt ou via configurações futuras do SDK.
    // Atualmente, para gemini-3.1-flash-tts-preview, passamos o texto e a configuração de voz.
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ 
        parts: [{ 
          text: `Aja como um narrador nativo do Brasil. Leia o seguinte texto em Português Brasileiro com velocidade ${speed}x e tom de voz ${pitch >= 0 ? '+' : ''}${pitch} semitons: ${text}` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceId },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("Não foi possível gerar o áudio. Nenhuma resposta recebida do modelo.");
    }

    // Decode base64 to binary
    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Gemini TTS returns raw PCM 16-bit mono 24kHz. 
    // To make it a playable WAV, we add a 44-byte header.
    return addWavHeader(bytes, 24000);
  } catch (error) {
    console.error("Erro na geração de TTS:", error);
    throw error;
  }
}

function addWavHeader(pcmData: Uint8Array, sampleRate: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true); // PCM
  // channel count
  view.setUint16(22, 1, true); // Mono
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, pcmData.length, true);
  
  const blob = new Uint8Array(header.byteLength + pcmData.length);
  blob.set(new Uint8Array(header), 0);
  blob.set(pcmData, 44);
  
  return blob.buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
