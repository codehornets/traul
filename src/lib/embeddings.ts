const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.TRAUL_EMBED_MODEL ?? "snowflake-arctic-embed2";
const EMBED_DIMS = 1024;
const BATCH_SIZE = 50;

export { EMBED_DIMS, EMBED_MODEL, BATCH_SIZE, MAX_TEXT_LENGTH };

// snowflake-arctic-embed2 context is 8192 tokens.
// Non-Latin (Cyrillic, CJK) text uses ~2-4 tokens per char.
// Pre-truncate texts before sending to Ollama to avoid massive payloads.
const MAX_TEXT_LENGTH = 4000;
// Further truncation steps for retry on context overflow.
const TRUNCATE_LIMITS = [2000, 1000];

async function tryEmbedBatch(
  texts: string[]
): Promise<{ ok: true; embeddings: number[][] } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts, truncate: true }),
      signal: controller.signal,
    });

    const data = (await res.json()) as { embeddings?: number[][]; error?: string };
    if (data.embeddings) return { ok: true, embeddings: data.embeddings };
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "timeout after 30s" };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isContextOverflow(error: string): boolean {
  return error.includes("input length exceeds") || error.includes("context length");
}

export async function embed(text: string): Promise<Float32Array> {
  const input = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const result = await tryEmbedBatch([input]);
  if (result.ok) return new Float32Array(result.embeddings[0]);
  if (!isContextOverflow(result.error)) {
    throw new Error(`Ollama embedding failed: ${result.error}`);
  }
  for (const limit of TRUNCATE_LIMITS) {
    const truncated = await tryEmbedBatch([input.slice(0, limit)]);
    if (truncated.ok) return new Float32Array(truncated.embeddings[0]);
    if (!isContextOverflow(truncated.error)) {
      throw new Error(`Ollama embedding failed: ${truncated.error}`);
    }
  }
  throw new Error(`Message too long to embed even at ${TRUNCATE_LIMITS.at(-1)} chars`);
}

export async function embedBatch(
  texts: string[],
  onSkip?: (index: number, error: string) => void
): Promise<(Float32Array | null)[]> {
  const results: (Float32Array | null)[] = [];
  // Pre-truncate all texts to avoid sending megabyte payloads to Ollama
  const truncated = texts.map((t) => (t.length > MAX_TEXT_LENGTH ? t.slice(0, MAX_TEXT_LENGTH) : t));
  for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
    const batch = truncated.slice(i, i + BATCH_SIZE);
    const result = await tryEmbedBatch(batch);
    if (result.ok) {
      results.push(...result.embeddings.map((e) => new Float32Array(e)));
    } else if (isContextOverflow(result.error)) {
      // Batch has oversized items — fall back to individual embedding
      for (let j = 0; j < batch.length; j++) {
        const single = await tryEmbedBatch([batch[j].slice(0, TRUNCATE_LIMITS[0])]);
        if (single.ok) {
          results.push(new Float32Array(single.embeddings[0]));
        } else {
          onSkip?.(i + j, single.error);
          results.push(null);
        }
      }
    } else {
      // Timeout or other error — skip entire batch
      for (let j = 0; j < batch.length; j++) {
        onSkip?.(i + j, result.error);
        results.push(null);
      }
    }
  }
  return results;
}

export function vecToBytes(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer);
}
