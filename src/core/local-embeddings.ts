// Local in-process embedding provider using Hugging Face Transformers.js
// FEATURE: Zero-config semantic embeddings without external API dependencies

let pipeline: any = null;
let loadingPromise: Promise<any> | null = null;

const MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5";

async function getEmbeddingPipeline(): Promise<any> {
  if (pipeline) return pipeline;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const { pipeline: createPipeline } = await import("@huggingface/transformers");
    pipeline = await createPipeline("feature-extraction", MODEL_NAME, {
      dtype: "q8",
    });
    return pipeline;
  })();

  pipeline = await loadingPromise;
  loadingPromise = null;
  return pipeline;
}

export async function localEmbed(inputs: string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();
  const results: number[][] = [];

  for (const input of inputs) {
    const output = await extractor(input, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array).slice(0, output.dims[1]));
  }

  return results;
}

export async function isLocalEmbeddingAvailable(): Promise<boolean> {
  try {
    await getEmbeddingPipeline();
    return true;
  } catch {
    return false;
  }
}
