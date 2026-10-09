# Bendigo AI: local AI setup (Windows)

This guide connects the backend to an Ollama model running on the same computer. It does not require a third-party AI API key.

## 1. Install and start Ollama

Install Ollama from https://ollama.com/download, then open PowerShell and run:

```powershell
ollama --version
ollama pull qwen2.5:3b
```

If PowerShell cannot find `ollama`, open it from the Start menu or use its usual Windows executable location:

```powershell
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" --version
```

Ollama normally serves its local API at `http://127.0.0.1:11434`.

## 2. Configure Bendigo AI's backend

From the project root in PowerShell, set these variables in the same terminal session used to start the backend:

```powershell
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "qwen2.5:3b"
```

Install backend dependencies if needed, then start the API:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

If Python is not installed, install Python 3.12 or a compatible newer version first and reopen PowerShell.

## 3. Verify the connection

Open these URLs while the backend is running:

- Health: http://127.0.0.1:8000/api/health
- AI status: http://127.0.0.1:8000/api/ai/status

The AI status should report `configured: true`, `provider: "ollama"`, and model `qwen2.5:3b`. Then test a chat message and a code-generation request in the frontend configured to use this backend.

## Important: local computer vs. Render

`127.0.0.1` always means the machine running the backend. If Bendigo AI is deployed on Render, setting `OLLAMA_BASE_URL=http://127.0.0.1:11434` there will point to the Render service itself, not your Windows computer. Do not use that value in Render. To power the public website with Ollama, the model service must be hosted at a securely reachable endpoint; keep it private, protect access, and consider hosting costs and resource requirements.

Without either Ollama or an AI gateway configured, Bendigo AI uses its built-in fallback responses and code templates. A successful health check alone does not prove a live model request succeeded.
