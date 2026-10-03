import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let extractorPromise: Promise<any> | null = null;

const getExtractor = async () => {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { device: 'wasm' }
    );
  }
  return extractorPromise;
};

export const embed = async (text: string): Promise<number[]> => {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
};

export const embedBatch = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const results: number[][] = [];

  const batchSize = 8;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const output = await extractor(batch, { pooling: 'mean', normalize: true });
    const dims = output.dims;

    for (let j = 0; j < dims[0]; j++) {
      const start = j * dims[2];
      const end = start + dims[2];
      results.push(Array.from(output.data.slice(start, end) as Float32Array));
    }
  }

  return results;
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};
