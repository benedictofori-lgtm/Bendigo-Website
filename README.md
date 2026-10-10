# Bendigo AI

Bendigo AI is a web workspace with a Python/FastAPI backend. The backend provides chat, code-generation starter templates, chat history, health/status endpoints, and optional PostgreSQL, AI-model, and GitHub write integrations.

## Backend deployment

The Render web service uses:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

After deployment, open `/docs` on the backend URL to view the interactive API documentation.

## Useful endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /` | Basic service information |
| `GET /api/health` | Health, database configuration, AI configuration, and GitHub read-access check |
| `GET /api/test` | Feature availability summary |
| `GET /api/status` | Service status |
| `GET /api/db/status` | PostgreSQL connectivity status |
| `GET /api/ai/status` | AI provider configuration without returning credentials |
| `GET /api/github/status` | Public repository read access and whether write access is configured |
| `POST /api/chat` | Chat response and fallback/model metadata |
| `POST /api/chat/stream` | Server-sent-event chat response |
| `GET /api/chat/history?sessionId=default` | Read a session's recent messages |
| `DELETE /api/chat/history?sessionId=default` | Clear a session's history |
| `POST /api/code` | Generate code with a configured model or a clearly marked starter template |

## Optional integrations

- **PostgreSQL:** Configure the Render service's `DATABASE_URL` using the database's internal connection string. Do not commit connection strings to GitHub.
- **AI model:** Configure a supported server-side AI gateway with `AI_BASE_URL` and `AI_MODEL`, plus `AI_API_KEY` only if the provider requires it; or configure an accessible Ollama endpoint with `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. Never put server credentials in frontend JavaScript.
- **GitHub writes:** Configure `GITHUB_TOKEN` as a protected Render environment variable only if the workspace needs to create branches or commits. Without it, repository features should remain read-only.

If no AI model is configured or reachable, chat and code endpoints return basic fallback responses/templates. A live deployment alone does not mean a full language model is configured.

## Run backend tests

Install dependencies, then run:

```bash
python -m unittest discover -s tests -v
```

The endpoint tests use Python's built-in `unittest` framework and avoid making live GitHub or database requests.
