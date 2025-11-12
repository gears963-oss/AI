## Backend (Serverless-style)

### Overview

This backend exposes a single scoring endpoint suitable for serverless platforms (e.g., Vercel). It calls an LLM provider to produce a JSON response.

Endpoint: `POST /api/score`

Body:

```json
{
  "icp": { "...": "..." },
  "features": { "...": "..." },
  "pageText": "optional text blob"
}
```

Response (STRICT JSON from LLM, validated):

```json
{
  "score_ai": 0,
  "reasons_ai": ["...", "...", "..."],
  "labels": ["tag1", "tag2"]
}
```

### Environment

- `LLM_PROVIDER_URL`: URL to a chat-completions-compatible API
- `LLM_API_KEY`: API key (never exposed to the extension)
- `LLM_MODEL`: model name (e.g., `gpt-4o-mini`, `claude-mini`)

If env vars are missing, a local stub is used.

### Local Development

```bash
# from repo root
npm i
npm run dev        # runs tsx watch backend/api/score.ts

# OR build and run
npm run build      # builds backend and extension
npm start          # node dist/api/score.js
```

Then POST to `http://localhost:3001` with the JSON body above.

### Vercel Deployment

You can deploy `backend/api/score.ts` as a serverless function:

1. Create a new Vercel project
2. Add env vars `LLM_PROVIDER_URL`, `LLM_API_KEY`, `LLM_MODEL`
3. Use the repository as source; Vercel will detect the function at `backend/api/score.ts`
4. After deploy, call `https://your-app.vercel.app/api/score`

Notes:
- Ensure the extension never embeds your API key; the backend is the only component calling the LLM.



