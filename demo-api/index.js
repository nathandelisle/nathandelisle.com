// Proxy for the Geometric Uncertainty demo (nathandelisle.com/demo).
// Holds the OpenRouter key as a secret; the browser never sees it.
// POST /sample {question} -> {greedy, samples[30]}

const MODEL = 'meta-llama/llama-3.1-8b-instruct';
const N = 30;
const SYSTEM = 'Answer with only the answer — a name, date, or short phrase. No other words.';

const ALLOWED_ORIGINS = new Set([
  'https://nathandelisle.com',
  'https://www.nathandelisle.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://nathandelisle.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

async function openrouter(key, question, temperature, n) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: question },
    ],
    temperature,
    max_tokens: 40,
  };
  if (n > 1) body.n = n;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.choices) throw new Error('upstream: ' + JSON.stringify(data).slice(0, 200));
  return data.choices.map(c => (c.message.content || '').trim()).filter(Boolean);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/sample') {
      return new Response(JSON.stringify({ error: 'POST /sample' }), { status: 404, headers });
    }
    try {
      if (!env.OPENROUTER_API_KEY) {
        return new Response(JSON.stringify({ error: 'key not configured' }), { status: 500, headers });
      }
      const { question } = await request.json();
      if (typeof question !== 'string' || question.trim().length < 4 || question.length > 200) {
        return new Response(JSON.stringify({ error: 'question must be 4–200 characters' }),
          { status: 400, headers });
      }
      const q = question.trim();
      const [greedyArr, batch] = await Promise.all([
        openrouter(env.OPENROUTER_API_KEY, q, 0, 1),
        openrouter(env.OPENROUTER_API_KEY, q, 1, N),
      ]);
      let samples = batch;
      while (samples.length < N) {
        samples = samples.concat(await openrouter(env.OPENROUTER_API_KEY, q, 1, 1));
      }
      return new Response(JSON.stringify({ greedy: greedyArr[0], samples: samples.slice(0, N) }),
        { headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  },
};
