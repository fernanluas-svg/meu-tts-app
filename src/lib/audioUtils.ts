export function splitTextIntoChunks(text: string, maxChunkLength: number = 800): string[] {
  // Regex to split by sentence endings while keeping the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+/g) || [text];
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If a single sentence is longer than max length, we must force split it by words
    if (trimmedSentence.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      
      const words = trimmedSentence.split(/\s+/);
      let wordChunk = "";
      for (const word of words) {
        if ((wordChunk + " " + word).length > maxChunkLength) {
          chunks.push(wordChunk.trim());
          wordChunk = word;
        } else {
          wordChunk += (wordChunk ? " " : "") + word;
        }
      }
      if (wordChunk) currentChunk = wordChunk;
      continue;
    }

    if ((currentChunk + " " + trimmedSentence).length > maxChunkLength) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

interface WavDataInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

function getWavDataInfo(buffer: ArrayBuffer): WavDataInfo | null {
  const u8 = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (buffer.byteLength < 12) return null;
  const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  const wave = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, buffer.byteLength - dataOffset);
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) return null;

  return { sampleRate, channels, bitsPerSample, dataOffset, dataLength };
}

export async function combineWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) return new Blob();
  if (blobs.length === 1) return blobs[0];

  const buffers = await Promise.all(blobs.map(b => b.arrayBuffer()));
  const infos = buffers.map(getWavDataInfo);
  const valid = infos.filter((i): i is WavDataInfo => i !== null);

  if (valid.length === 0) {
    throw new Error("Nenhum dos áudios gerados é um WAV válido.");
  }

  const first = valid[0];
  let totalDataLength = 0;
  for (const info of valid) {
    totalDataLength += info.dataLength;
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalDataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, first.channels || 1, true);
  view.setUint32(24, first.sampleRate || 22050, true);
  view.setUint32(28, (first.sampleRate || 22050) * (first.channels || 1) * 2, true);
  view.setUint16(32, (first.channels || 1) * 2, true);
  view.setUint16(34, first.bitsPerSample || 16, true);
  writeString(36, 'data');
  view.setUint32(40, totalDataLength, true);

  const result = new Uint8Array(44 + totalDataLength);
  result.set(new Uint8Array(header), 0);

  let offset = 44;
  for (let i = 0; i < buffers.length; i++) {
    const info = infos[i];
    if (!info) continue;
    const data = new Uint8Array(buffers[i], info.dataOffset, info.dataLength);
    result.set(data, offset);
    offset += info.dataLength;
  }

  return new Blob([result], { type: 'audio/wav' });
}
