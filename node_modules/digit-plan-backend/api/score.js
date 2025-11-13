export default async function handler(req, res) {
  // CORS & preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(405).json({ error: 'POST required' });
  }

  res.setHeader('Access-Control-Allow-Origin','*');

  try {
    // Read body manually for Vercel
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyStr = Buffer.concat(chunks).toString('utf-8');
    const body = bodyStr ? JSON.parse(bodyStr) : {};
    const { icp, features, pageText } = body;

    const url = process.env.LLM_PROVIDER_URL;
    const key = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';

    // Fallback de test si pas de clé
    if (!url || !key) {
      return res.status(200).json({
        score_ai: 42,
        reasons_ai: ['Backend OK sans clé', 'Configure LLM_API_KEY sur Vercel', 'Réponse de test'],
        labels: ['no-key']
      });
    }

    const prompt = `
RENVOIE UNIQUEMENT DU JSON STRICT:

{"score_ai":0,"reasons_ai":["...","...","..."],"labels":["..."]}

Context:

ICP=${JSON.stringify(icp||{})}

FEATURES=${JSON.stringify(features||{})}

TEXT=${(pageText||'').slice(0,6000)}

- score_ai dans [0,100]

- 3 raisons concises

- 0..8 labels

`.trim();

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    const rawText = await r.text(); // on lit toujours en texte
    let llmText = rawText;
    try {
      const data = JSON.parse(rawText);
      llmText = data?.choices?.[0]?.message?.content || rawText;
    } catch { /* pas du JSON OpenAI, on garde rawText */ }

    // Si l'IA renvoie une erreur HTTP, on remonte le détail
    if (!r.ok) {
      return res.status(r.status).json({
        error: `LLM HTTP ${r.status}`,
        detail: llmText.slice(0, 500)
      });
    }

    // Isoler le JSON dans le contenu
    const start = llmText.indexOf('{');
    const end = llmText.lastIndexOf('}');
    const onlyJson = start >= 0 ? llmText.slice(start, end + 1) : '{}';

    let parsed;
    try { parsed = JSON.parse(onlyJson); } catch { parsed = {}; }

    const score_ai = Math.max(0, Math.min(100, Number(parsed.score_ai || 0)));
    const reasons_ai = Array.isArray(parsed.reasons_ai) ? parsed.reasons_ai.slice(0,3) : [];
    const labels = Array.isArray(parsed.labels) ? parsed.labels : [];

    return res.status(200).json({ score_ai, reasons_ai, labels });
  } catch (e) {
    return res.status(500).json({ error: String(e).slice(0, 400) });
  }
}
