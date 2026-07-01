// Embeds answers and runs the canonical geometry off the main thread.
import { analyze } from './geometry.js';

let embedderP = null;
function getEmbedder() {
  if (!embedderP) {
    embedderP = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0')
      .then(m => {
        m.env.allowLocalModels = false;
        return m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
      });
  }
  return embedderP;
}

self.onmessage = async ev => {
  const { texts } = ev.data;
  try {
    postMessage({ stage: 'embedding' });
    const extractor = await getEmbedder();
    const out = await extractor(texts, { pooling: 'mean', normalize: true });
    const [n, d] = out.dims;
    const E = [];
    for (let i = 0; i < n; i++) E.push(Array.from(out.data.slice(i * d, (i + 1) * d)));
    postMessage({ stage: 'analyzing' });
    const { P3, Z3, S, volume } = analyze(E);
    postMessage({ result: { P3, Z3, S, volume } });
  } catch (e) {
    postMessage({ error: String((e && e.message) || e) });
  }
};
