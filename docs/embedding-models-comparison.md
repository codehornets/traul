# Embedding Models Comparison for Traul Local Search (2025-2026)

Replacing `snowflake-arctic-embed2` (568M params, 1024 dims, 1.2GB in Ollama, BEIR ~55.65).

## Ranked Comparison

| Rank | Model | Released | Params | Dims | MTEB Multi (Mean) | Multilingual (RU+EN) | Ollama | Size (Ollama) | Context | Short Text Fit |
|------|-------|----------|--------|------|-------------------|----------------------|--------|---------------|---------|----------------|
| 1 | **Qwen3-Embedding-0.6B** | Jun 2025 | 0.6B | up to 1024 (MRL) | **64.33** | 100+ langs | `qwen3-embedding:0.6b` | 639 MB | 32K | Excellent — instruction-aware, flexible dims |
| 2 | **BGE-M3** | Feb 2024 | 567M | 1024 | 59.56 | 100+ langs | `bge-m3` | 1.2 GB | 8K | Very good — dense+sparse+multivec hybrid |
| 3 | **Nomic Embed Text v2 MoE** | Mar 2025 | 475M (305M active) | 768 (MRL to 256) | ~60* (MIRACL 65.80) | ~100 langs | `nomic-embed-text-v2-moe` | 958 MB | 512 | Good for short text; 512 token limit is fine |
| 4 | **Jina Embeddings v3** | Sep 2024 | 572M | up to 1024 (MRL) | ~62** | 89 langs (incl. Russian) | Not in Ollama; GGUF on HF | ~1.2 GB | 8K | Excellent — task LoRA adapters for query vs doc |
| 5 | **snowflake-arctic-embed2** (current) | Dec 2024 | 568M | 1024 | ~55-56 (BEIR 55.65) | Multilingual (limited) | `snowflake-arctic-embed2` | 1.2 GB | 8K | Good |
| 6 | **GTE-Qwen2-1.5B-instruct** | Jun 2024 | 1.5B | 1536 | 59.45 | Multilingual | Not in Ollama | ~3 GB | 32K | Good but large |
| 7 | **EmbeddingGemma** | Late 2024 | 300M | 768 | ~50*** | English-focused | `embeddinggemma` | ~600 MB | 2K | OK for English only |

\* Nomic v2 MoE: BEIR 52.86, MIRACL 65.80 — strong multilingual retrieval, weaker English-only.
\** Jina v3: self-reported strong MTEB; individual task scores vary; overall competitive with BGE-M3.
\*** EmbeddingGemma: limited multilingual; not recommended for RU+EN use case.

## Detailed Analysis

### 1. Qwen3-Embedding-0.6B (RECOMMENDED)

- **Best quality-to-size ratio** in 2025. Outperforms models 2-10x its size on MTEB Multilingual.
- MTEB Multilingual Mean: 64.33 (beats BGE-M3 at 59.56, multilingual-e5-large at 63.22).
- Supports Matryoshka Representation Learning: use 512 or 256 dims to save storage with minimal quality loss.
- Instruction-aware: can specify task type for better query vs document embeddings.
- Native Ollama support at only 639 MB.
- 100+ languages including Russian and English.
- 32K context window (overkill for short messages, but no truncation issues).

### 2. BGE-M3

- Battle-tested, widely adopted (3.6M Ollama pulls).
- Unique: supports dense + sparse + multi-vector retrieval simultaneously.
- Excellent Russian support (trained on 100+ languages).
- Slightly lower MTEB scores than Qwen3-Embedding-0.6B but proven in production.
- 1.2 GB — slightly over the 1 GB preference but acceptable.

### 3. Nomic Embed Text v2 MoE

- MoE architecture: 475M total but only 305M active — fast inference.
- MIRACL 65.80 — best multilingual retrieval in its size class.
- Fully open-source (weights, code, training data).
- 512 token limit is actually ideal for short message search.
- Matryoshka support down to 256 dims.

### 4. Jina Embeddings v3

- Task-specific LoRA adapters (query, passage, classification, clustering).
- Strong multilingual with explicit Russian support.
- **Not in Ollama library** — requires manual GGUF setup or API usage.
- 89 languages explicitly tuned.

## Recommendation

**Qwen3-Embedding-0.6B** is the clear winner for Traul:

1. Highest MTEB multilingual score among sub-1B models (64.33)
2. Smallest Ollama size (639 MB) — well under 1 GB target
3. Native Ollama support (`ollama pull qwen3-embedding:0.6b`)
4. 100+ languages with strong Russian + English
5. Matryoshka dims — can use 512d or 256d for faster search with minimal quality loss
6. Instruction-aware — better short query handling
7. Apache 2.0 license

**Migration note**: Switching from `snowflake-arctic-embed2` (1024d) to `qwen3-embedding:0.6b` (1024d or lower) requires re-indexing all existing embeddings. The dimension can be kept at 1024 for compatibility or reduced to 512 for ~50% storage savings.

**Runner-up**: BGE-M3 if you want proven stability and hybrid retrieval (dense+sparse).
