// Pure formatting helpers — no node-llama-cpp dependency

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
