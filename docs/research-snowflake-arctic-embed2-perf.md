# snowflake-arctic-embed2 Alternating Slow/Fast Pattern in Ollama 0.18.0

## Root Cause Analysis

The alternating slow/fast pattern is most likely caused by **output buffer reallocation** combined with **KV cache management overhead** specific to how Ollama handles BERT-architecture embedding models.

### Primary Cause: Output Buffer Reallocation

Ollama issue [#14314](https://github.com/ollama/ollama/issues/14314) documents the exact same symptom — embedding requests getting progressively slower. The server logs show:

```
output_reserve: reallocating output buffer from size 10.52 MiB to 200.89 MiB
```

This reallocation happens because:
1. For embedding models, Ollama must mark **all input tokens as output tokens** (the log message `"embeddings required but some input tokens were not marked as outputs -> overriding"` confirms this).
2. The output buffer is sized to hold the embedding vectors for all tokens. When the buffer is too small, it triggers a **synchronous reallocation** on the GPU, which takes ~5-6 seconds on Metal.
3. The alternating pattern suggests the buffer is being **freed or shrunk** between requests (possibly during KV cache cleanup), then reallocated on the next request.

### Contributing Factor: KV Cache Behavior for BERT Models

Per Ollama issue [#6214](https://github.com/ollama/ollama/issues/6214) (opened by Ollama's founder):
- Embedding models **should not need a KV cache** but Ollama still allocates one
- The default `num_ctx` for snowflake-arctic-embed2 is **8192**, which means a large KV cache is allocated unnecessarily
- Embedding models should use **higher parallelization (10+)** but this is not yet implemented

The KV cache is allocated as: `KvSize = num_ctx * numParallel`. With num_ctx=8192 and even 1 parallel slot, this is a significant allocation that gets managed (cleared/defragged) between requests.

### Why Other Models Don't Have This Issue

- **nomic-embed-text** and **mxbai-embed-large** have smaller context windows (2048 default) and smaller model sizes, so buffer reallocation is faster and less impactful
- snowflake-arctic-embed2 is **F16 with 566M params and 8192 context** — the output buffer and KV cache are proportionally much larger
- The overhead of reallocating a ~200MB output buffer on Metal is significant compared to the actual embedding computation (~100ms)

### Why Parallel Calls Are All Slow

When parallel requests arrive simultaneously, **each request needs its own output buffer allocation**. The combined memory pressure (multiple 200MB allocations + KV cache slots) causes all requests to hit the slow reallocation path.

## Quantized Variants Available

Yes, quantized GGUF versions exist on HuggingFace:
- [Casual-Autopsy/snowflake-arctic-embed-l-v2.0-gguf](https://huggingface.co/Casual-Autopsy/snowflake-arctic-embed-l-v2.0-gguf) — Q4_K_S (424MB), Q4_K_M (438MB), Q8_0 (635MB)
- [limcheekin/snowflake-arctic-embed-l-v2.0-GGUF](https://huggingface.co/limcheekin/snowflake-arctic-embed-l-v2.0-GGUF)

However, Ollama's official `snowflake-arctic-embed2` library tag only ships F16. You could import a quantized GGUF via a custom Modelfile. Note: embedding models are more sensitive to quantization than generation models.

## Workarounds

### 1. Reduce num_ctx via Modelfile
Create a Modelfile to lower the context window, reducing buffer sizes:
```
FROM snowflake-arctic-embed2
PARAMETER num_ctx 512
```
Then: `ollama create snowflake-arctic-embed2-fast -f Modelfile`

### 2. Use a Different Embedding Model
nomic-embed-text and mxbai-embed-large don't exhibit this issue and are consistently fast when warm.

### 3. Batch Inputs in a Single Request
Use the `/api/embed` endpoint with multiple inputs in one call to amortize the buffer allocation cost across many embeddings.

### 4. Try the Quantized GGUF
Import a Q8_0 quantized version which is ~50% smaller, potentially reducing reallocation overhead:
```
FROM /path/to/snowflake-arctic-embed-l-v2.0-Q8_0.gguf
```

### 5. Set OLLAMA_NUM_PARALLEL=1
Ensure only 1 parallel slot to minimize KV cache memory overhead (this is the default, but verify).

## Relevant GitHub Issues

| Issue | Description | Status |
|-------|-------------|--------|
| [#14314](https://github.com/ollama/ollama/issues/14314) | Embeddings getting slower and slower (output buffer reallocation) | Closed (not planned) |
| [#6214](https://github.com/ollama/ollama/issues/6214) | Embedding model perf: disable KV cache, increase parallelization | Open (feature request) |
| [#7400](https://github.com/ollama/ollama/issues/7400) | Embed API 2x slower than Sentence Transformers | Open (bug, assigned) |
| [#12381](https://github.com/ollama/ollama/issues/12381) | "input tokens not marked as outputs" warning with snowflake-arctic-embed2 | Open |
| [#13340](https://github.com/ollama/ollama/issues/13340) | Memory issues since v0.13.1 with embedding models | Open |
| [#8778](https://github.com/ollama/ollama/issues/8778) | Parallel processing of embeddings request | Open |
| [#9511](https://github.com/ollama/ollama/issues/9511) | snowflake-arctic-embed2 GGUF assertion failure | Open |

## Summary

This is a known class of issues in Ollama's embedding pipeline. The core problem is that Ollama's runner was designed primarily for autoregressive generation, not BERT-style encoding. For embedding models, the output buffer must hold vectors for ALL input tokens (not just one next-token prediction), leading to large buffer allocations. The alternating slow/fast pattern is the buffer being deallocated/reallocated on alternating requests, likely due to the runner's cache management lifecycle clearing state between inference cycles.
