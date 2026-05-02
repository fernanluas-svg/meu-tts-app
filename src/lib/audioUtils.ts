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

export async function combineWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) return new Blob();
  if (blobs.length === 1) return blobs[0];

  // We assume all blobs are WAV files with identical parameters (header 44 bytes)
  // We take the header from the first one and adjust the size fields.
  // Then append only the data sections (after byte 44) of all blobs.
  
  return new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const firstArrayBuffer = reader.result as ArrayBuffer;
      const header = new DataView(firstArrayBuffer.slice(0, 44));
      
      let totalDataLength = 0;
      const dataSegments: Uint8Array[] = [];

      const processBlobs = async () => {
        for (let i = 0; i < blobs.length; i++) {
          const buffer = await blobs[i].arrayBuffer();
          const dataPart = new Uint8Array(buffer.slice(44));
          totalDataLength += dataPart.length;
          dataSegments.push(dataPart);
        }

        // Update header size fields
        // 4 (RIFF) + 4 (Size) + 4 (WAVE) + ...
        // Bytes 4-7: Total file size - 8
        header.setUint32(4, 36 + totalDataLength, true);
        // Bytes 40-43: Data chunk size
        header.setUint32(40, totalDataLength, true);

        const result = new Uint8Array(44 + totalDataLength);
        result.set(new Uint8Array(header.buffer), 0);
        let offset = 44;
        for (const segment of dataSegments) {
          result.set(segment, offset);
          offset += segment.length;
        }

        resolve(new Blob([result], { type: 'audio/wav' }));
      };

      processBlobs().catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blobs[0]);
  });
}
