import { getLlama, resolveModelFile, type Llama, type LlamaModel, type LlamaEmbeddingContext } from "node-llama-cpp";

// --- Formatting helpers (pure, no model dependency) ---

export function isQwenEmbeddingModel(uri: string): boolean {
  return /qwen.*embed/i.test(uri);
}

export function formatQuery(text: string, modelUri: string): string {
  if (isQwenEmbeddingModel(modelUri)) {
    return `Instruct: Retrieve relevant documents for the given query\nQuery: ${text}`;
  }
  return text;
}

export function formatDoc(text: string): string {
  return text;
}

// --- Singleton model wrapper ---

// Duplicated from embeddings.ts to avoid circular import
const MAX_TEXT_LENGTH = 4000;

const DEFAULT_MODEL = "hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const LLAMA_EMBED_MODEL = process.env.TRAUL_EMBED_MODEL ?? DEFAULT_MODEL;

// --- Singleton state ---
let llama: Llama | null = null;
let model: LlamaModel | null = null;
let ctx: LlamaEmbeddingContext | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** Reset singleton for testing. */
export function _resetForTesting(): void {
  llama = null;
  model = null;
  ctx = null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (ctx) { ctx.dispose(); ctx = null; }
    if (model) { await model.dispose(); model = null; }
  }, IDLE_TIMEOUT_MS);
  if (idleTimer && typeof idleTimer === "object" && "unref" in idleTimer) {
    (idleTimer as NodeJS.Timeout).unref();
  }
}

async function getContext(): Promise<LlamaEmbeddingContext> {
  if (ctx) {
    resetIdleTimer();
    return ctx;
  }

  if (!llama) {
    llama = await getLlama();
  }

  if (!model) {
    const modelPath = await resolveModelFile(LLAMA_EMBED_MODEL, {
      directory: `${process.env.HOME}/.cache/traul/models`,
      onProgress: ({ percent }) => {
        process.stderr.write(`\rDownloading model: ${Math.round(percent)}%`);
      },
    });
    model = await llama.loadModel({ modelPath });
  }

  ctx = await model.createEmbeddingContext();
  resetIdleTimer();
  return ctx;
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

const TRUNCATE_LIMITS = [2000, 1000];

async function embedSingle(embCtx: LlamaEmbeddingContext, text: string): Promise<Float32Array> {
  try {
    const { vector } = await embCtx.getEmbeddingFor(truncate(text));
    return new Float32Array(vector);
  } catch {
    // Retry with progressive truncation
    for (const limit of TRUNCATE_LIMITS) {
      try {
        const { vector } = await embCtx.getEmbeddingFor(text.slice(0, limit));
        return new Float32Array(vector);
      } catch {
        continue;
      }
    }
    throw new Error(`Text too long to embed even at ${TRUNCATE_LIMITS.at(-1)} chars`);
  }
}

export async function embedDoc(text: string): Promise<Float32Array> {
  const embCtx = await getContext();
  return embedSingle(embCtx, formatDoc(text));
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const embCtx = await getContext();
  return embedSingle(embCtx, formatQuery(text, LLAMA_EMBED_MODEL));
}

export async function embedDocBatch(
  texts: string[],
  onSkip?: (index: number, error: string) => void,
): Promise<(Float32Array | null)[]> {
  if (texts.length === 0) return [];
  const embCtx = await getContext();
  const results: (Float32Array | null)[] = [];

  for (let i = 0; i < texts.length; i++) {
    try {
      results.push(await embedSingle(embCtx, formatDoc(texts[i])));
    } catch (err) {
      onSkip?.(i, err instanceof Error ? err.message : String(err));
      results.push(null);
    }
  }

  return results;
}

export async function dispose(): Promise<void> {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (ctx) { ctx.dispose(); ctx = null; }
  if (model) { await model.dispose(); model = null; }
}
