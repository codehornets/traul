const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.TRAUL_EMBED_MODEL ?? "snowflake-arctic-embed2";
const EMBED_DIMS = 1024;
const BATCH_SIZE = 50;

export { EMBED_DIMS, EMBED_MODEL, BATCH_SIZE };

// snowflake-arctic-embed2 context is 8192 tokens.
// Non-Latin (Cyrillic, CJK) text uses ~2-4 tokens per char.
// Truncation steps for retry on context overflow.
const TRUNCATE_LIMITS = [4000, 2000, 1000];

async function tryEmbedBatch(
  texts: string[]
): Promise<{ ok: true; embeddings: number[][] } | { ok: false; error: string }> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, truncate: true }),
  });

  const data = (await res.json()) as { embeddings?: number[][]; error?: string };
  if (data.embeddings) return { ok: true, embeddings: data.embeddings };
  return { ok: false, error: data.error ?? `HTTP ${res.status}` };
}

function isContextOverflow(error: string): boolean {
  return error.includes("input length exceeds") || error.includes("context length");
}

export async function embed(text: string): Promise<Float32Array> {
  const result = await tryEmbedBatch([text]);
  if (result.ok) return new Float32Array(result.embeddings[0]);
  if (!isContextOverflow(result.error)) {
    throw new Error(`Ollama embedding failed: ${result.error}`);
  }
  for (const limit of TRUNCATE_LIMITS) {
    const truncated = await tryEmbedBatch([text.slice(0, limit)]);
    if (truncated.ok) return new Float32Array(truncated.embeddings[0]);
    if (!isContextOverflow(truncated.error)) {
      throw new Error(`Ollama embedding failed: ${truncated.error}`);
    }
  }
  throw new Error(`Message too long to embed even at ${TRUNCATE_LIMITS.at(-1)} chars`);
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await tryEmbedBatch(batch);
    if (result.ok) {
      results.push(...result.embeddings.map((e) => new Float32Array(e)));
    } else if (isContextOverflow(result.error)) {
      // Batch has oversized items — fall back to individual embedding
      for (const text of batch) {
        results.push(await embed(text));
      }
    } else {
      throw new Error(`Ollama batch embedding failed: ${result.error}`);
    }
  }
  return results;
}

export function vecToBytes(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer);
}
