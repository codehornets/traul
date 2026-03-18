export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  docTitle?: string;
}

export interface Chunk {
  index: number;
  content: string;
  embeddingInput: string;
}

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_OVERLAP = 200;
export const CHUNK_THRESHOLD = 2000;
export const CHUNKER_VERSION = "1";

export function shouldChunk(text: string, threshold: number = CHUNK_THRESHOLD): boolean {
  return text.length > threshold;
}

function findWordBoundary(text: string, pos: number, direction: "back" | "forward"): number {
  if (pos >= text.length) return text.length;
  if (pos <= 0) return 0;

  if (direction === "back") {
    let i = pos;
    while (i > 0 && !/\s/.test(text[i])) i--;
    return i > 0 ? i + 1 : pos;
  } else {
    let i = pos;
    while (i < text.length && !/\s/.test(text[i])) i++;
    return i;
  }
}

export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
  const maxSize = options?.maxChunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const title = options?.docTitle;

  if (text.length <= maxSize) {
    const embeddingInput = title ? `Document: ${title}\n\n${text}` : text;
    return [{ index: 0, content: text, embeddingInput }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + maxSize;

    if (end >= text.length) {
      end = text.length;
    } else {
      end = findWordBoundary(text, end, "back");
      if (end <= start) end = start + maxSize;
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      const embeddingInput = title ? `Document: ${title}\n\n${content}` : content;
      chunks.push({ index, content, embeddingInput });
      index++;
    }

    if (end >= text.length) break;

    let nextStart = end - overlap;
    nextStart = findWordBoundary(text, nextStart, "forward");
    if (nextStart <= start) nextStart = end;
    start = nextStart;
  }

  return chunks;
}
