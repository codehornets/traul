const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.TRAUL_EMBED_MODEL ?? "nomic-embed-text";
const EMBED_DIMS = 768;
const BATCH_SIZE = 50;

export { EMBED_DIMS };

// nomic-embed-text architecture context is 2048 tokens.
// Non-Latin (Cyrillic, CJK) text uses ~2-4 tokens per char.
// Start with full text, retry with shorter input on context overflow.
const TRUNCATE_STEPS = [undefined, 4000, 2000, 1000];

async function tryEmbed(text: string): Promise<{ ok: true; embedding: number[] } | { ok: false; error: string }> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  const data = (await res.json()) as { embedding?: number[]; error?: string };
  if (data.embedding) return { ok: true, embedding: data.embedding };
  return { ok: false, error: data.error ?? `HTTP ${res.status}` };
}

export async function embed(text: string): Promise<Float32Array> {
  for (const limit of TRUNCATE_STEPS) {
    const input = limit ? text.slice(0, limit) : text;
    const result = await tryEmbed(input);
    if (result.ok) return new Float32Array(result.embedding);
    if (!result.error.includes("input length exceeds")) {
      throw new Error(`Ollama embedding failed: ${result.error}`);
    }
  }
  throw new Error(`Message too long to embed even at ${TRUNCATE_STEPS.at(-1)} chars`);
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const promises = batch.map((t) => embed(t));
    results.push(...(await Promise.all(promises)));
  }
  return results;
}

export function vecToBytes(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer);
}
