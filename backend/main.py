from datetime import datetime, timezone
from html import escape, unescape
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen
import json
import logging
import os
import re
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg



APP_VERSION = "1.2.1"
GITHUB_REPO = "benedictofori-lgtm/Bendigo-website"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()

app = FastAPI(
    title="Bendigo AI Backend",
    description="Secure backend services for the Bendigo AI workspace.",
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://benedictofori-lgtm.github.io",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

chat_history: dict[str, list[dict[str, str]]] = {}
logger = logging.getLogger(__name__)


def database_configured() -> bool:
    return bool(DATABASE_URL)


def db_connect():
    if not DATABASE_URL:
        return None
    return psycopg.connect(DATABASE_URL, connect_timeout=10)


def init_database() -> None:
    if not DATABASE_URL:
        return
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGSERIAL PRIMARY KEY,
                    session_id VARCHAR(120) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time
                ON chat_messages (session_id, created_at, id)
            """)
        conn.commit()


def db_get_history(session_id: str, limit: int = 40) -> list[dict[str, str]]:
    if not DATABASE_URL:
        return chat_history.get(session_id, [])
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role, content FROM chat_messages WHERE session_id = %s ORDER BY created_at DESC, id DESC LIMIT %s",
                (session_id, limit),
            )
            rows = list(reversed(cur.fetchall()))
    return [{"role": role, "content": content} for role, content in rows]


def db_add_messages(session_id: str, messages: list[dict[str, str]]) -> None:
    if not messages:
        return
    if not DATABASE_URL:
        chat_history[session_id] = (chat_history.get(session_id, []) + messages)[-40:]
        return
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (%s, %s, %s)",
                [(session_id, item["role"], item["content"]) for item in messages],
            )
        conn.commit()


def db_delete_history(session_id: str) -> None:
    if not DATABASE_URL:
        chat_history.pop(session_id, None)
        return
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chat_messages WHERE session_id = %s", (session_id,))
        conn.commit()


@app.on_event("startup")
async def startup_database() -> None:
    try:
        init_database()
    except psycopg.Error:
        # Keep the API available during temporary database outages. Database
        # requests still fail visibly until the connection is restored.
        logger.exception("Database initialization failed; database-backed features may be unavailable.")

# Optional server-side AI model gateway.
# No model credential is ever sent to the browser.
AI_BASE_URL = os.getenv("AI_BASE_URL", "").strip().rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "").strip()
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
# Ollama is opt-in: set OLLAMA_BASE_URL locally to avoid pointing Render at localhost.
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").strip().rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def ollama_configured() -> bool:
    return bool(OLLAMA_BASE_URL and OLLAMA_MODEL)


def ai_gateway_configured() -> bool:
    return bool(AI_BASE_URL and AI_MODEL)


def ai_configured() -> bool:
    return ai_gateway_configured() or ollama_configured()


def probe_ollama() -> dict[str, Any]:
    """Verify that a configured Ollama endpoint is reachable and has the selected model."""
    if not ollama_configured():
        return {"status": "not_configured", "reachable": False, "modelAvailable": False}
    request = Request(
        OLLAMA_BASE_URL + "/api/tags",
        headers={"Accept": "application/json", "User-Agent": "Bendigo-AI"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
        models = data.get("models", [])
        available = any(
            isinstance(item, dict)
            and str(item.get("name", "")).split(":")[0] == OLLAMA_MODEL.split(":")[0]
            for item in models
        )
        return {
            "status": "ready" if available else "model_missing",
            "reachable": True,
            "modelAvailable": available,
        }
    except Exception:
        # Do not expose endpoint details, network errors, or credentials in a public status response.
        return {"status": "unreachable", "reachable": False, "modelAvailable": False}


def ai_model_reply(message: str, history: list[dict[str, Any]]):
    # The browser may include the current prompt in history and also send it
    # separately as message. Remove that trailing duplicate before appending it.
    history_items = list(history[-20:])
    if (
        history_items
        and history_items[-1].get("role") == "user"
        and str(history_items[-1].get("content", "")).strip() == message.strip()
    ):
        history_items.pop()

    if ollama_configured():
        messages = [{
            "role": "system",
            "content": (
                "You are Bendigo AI, a helpful coding and learning assistant. "
                "Give accurate, clear answers. When writing code, explain important choices "
                "and keep unsafe or destructive operations out of generated examples."
            ),
        }]
        for item in history_items:
            role = item.get("role")
            text = str(item.get("content", "")).strip()
            if role in {"user", "assistant", "system"} and text:
                messages.append({"role": role, "content": text})
        messages.append({"role": "user", "content": message})
        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
        }).encode("utf-8")
        request = Request(
            OLLAMA_BASE_URL + "/api/chat",
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Bendigo-AI"},
            method="POST",
        )
        with urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
        answer = data.get("message", {}).get("content")
        if answer and str(answer).strip():
            return str(answer).strip()
        raise RuntimeError("Ollama returned no text.")

    if not ai_gateway_configured():
        return None

    input_items = []
    for item in history_items:
        role = item.get("role")
        content = str(item.get("content", "")).strip()
        if role in {"user", "assistant", "system"} and content:
            input_items.append({"role": role, "content": content})
    input_items.append({"role": "user", "content": message})

    payload = json.dumps({
        "model": AI_MODEL,
        "input": input_items,
        "instructions": (
            "You are Bendigo AI, a helpful coding and learning assistant. "
            "Give accurate, clear answers. When writing code, explain important choices "
            "and keep unsafe or destructive operations out of generated examples."
        ),
    }).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Bendigo-AI",
    }
    if AI_API_KEY:
        headers["Authorization"] = "Bearer " + AI_API_KEY

    request = Request(AI_BASE_URL + "/responses", data=payload, headers=headers, method="POST")
    with urlopen(request, timeout=90) as response:
        data = json.loads(response.read().decode("utf-8"))

    output_text = data.get("output_text")
    if output_text:
        return str(output_text)

    # Compatibility fallback for response objects that expose message output items.
    parts = []
    for item in data.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                parts.append(str(content["text"]))
    if parts:
        return "\n".join(parts)

    raise RuntimeError("The AI model returned no text.")

def sse_event(event: str, data: str) -> str:
    safe = data.replace("\r", "").replace("\n", "\ndata: ")
    return f"event: {event}\ndata: {safe}\n\n"



class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    sessionId: str | None = Field(default=None, max_length=120)
    history: list[dict[str, Any]] = Field(default_factory=list, max_length=40)


class CodeRequest(BaseModel):
    language: str = Field(min_length=1, max_length=30)
    prompt: str = Field(min_length=1, max_length=8000)


class GithubBranchRequest(BaseModel):
    branch: str = Field(min_length=1, max_length=80)


class GithubCommitRequest(BaseModel):
    branch: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=200)
    files: dict[str, str] = Field(min_length=1, max_length=20)


class GithubPullRequestRequest(BaseModel):
    branch: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=10000)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def github_repository_accessible() -> bool:
    """Check public repository access without requiring a write token."""
    request = Request(
        "https://api.github.com/repos/" + GITHUB_REPO,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "Bendigo-AI",
        },
    )
    try:
        with urlopen(request, timeout=4) as response:
            return 200 <= getattr(response, "status", 200) < 300
    except Exception:
        return False


def github_request(method: str, path: str, payload: dict | None = None):
    if not GITHUB_TOKEN:
        raise RuntimeError("GitHub write access is not configured on the server.")
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + GITHUB_TOKEN,
        "User-Agent": "Bendigo-AI",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = Request("https://api.github.com" + path, data=data, headers=headers, method=method)
    with urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def github_write_error(exc: Exception):
    return {"success": False, "error": "GitHub write operation failed.", "details": str(exc)[:500]}


def clean_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", unescape(value)).strip()


def make_reply(message: str) -> str:
    """Provide useful, honest built-in help when no language model is connected."""
    text = message.strip()
    lower = text.lower()
    compact = re.sub(r"\s+", " ", lower).strip()

    if compact in {"hello", "hi", "hey", "hello bendigo ai", "good morning", "good afternoon"}:
        return "Hello! I'm Bendigo AI. I can help with beginner programming, project planning, and troubleshooting. Ask a specific question and I'll explain it step by step."

    if compact in {"help", "what can you do", "what can you do?", "how can you help me?"}:
        return (
            "I can explain common HTML, CSS, JavaScript, and Python concepts; give small examples; "
            "help you plan projects; and troubleshoot errors you share. For open-ended questions, "
            "live web research, and complex code generation, a connected language model is still needed."
        )

    if "variable" in compact and ("python" in compact or "program" in compact or "what is" in compact or "explain" in compact):
        return (
            "A variable is a name that refers to a value, so you can reuse that value in your program.\n\n"
            "Example in Python:\n\n    name = \"Bendigo\"\n    age = 15\n    print(name)\n    print(age)\n\n"
            "name refers to the text Bendigo, and age refers to the number 15. The equals sign assigns a value. "
            "Choose variable names that describe the data they hold."
        )

    if "for loop" in compact or "for-loop" in compact or ("loop" in compact and "python" in compact):
        return (
            "A loop repeats a block of code. A Python for loop is useful when you want to do something "
            "for each item in a sequence.\n\nExample:\n\n    for number in range(1, 4):\n        print(number)\n\n"
            "Output: 1, 2, 3. The stop value 4 is not included in range(1, 4)."
        )

    if "function" in compact and ("python" in compact or "program" in compact or "what is" in compact or "explain" in compact):
        return (
            "A function is a reusable block of code that performs a task. In Python, define one with def.\n\n"
            "    def greet(name):\n        return f\"Hello, {name}!\"\n\n    print(greet(\"Bendigo\"))\n\n"
            "Here, name is a parameter, return sends the result back, and calling greet with Bendigo prints Hello, Bendigo!"
        )

    if "if statement" in compact or "conditional" in compact or ("if" in compact and "python" in compact and ("explain" in compact or "what is" in compact)):
        return (
            "An if statement lets a program choose what to do based on a condition.\n\n"
            "    score = 75\n    if score >= 50:\n        print(\"Pass\")\n    else:\n        print(\"Try again\")\n\n"
            "Python checks whether score is at least 50. Indentation shows which statements belong to each branch."
        )

    if "list" in compact and ("python" in compact or "what is" in compact or "explain" in compact):
        return (
            "A Python list stores multiple items in one ordered, changeable collection.\n\n"
            "    subjects = [\"Maths\", \"English\", \"Computing\"]\n"
            "    print(subjects[0])  # Maths\n    subjects.append(\"Science\")\n    print(subjects)\n\n"
            "List indexes start at 0, so subjects[0] is the first item. append() adds an item to the end."
        )

    if "html" in compact and ("what is" in compact or "explain" in compact):
        return (
            "HTML defines the structure and meaning of a web page. Tags describe elements such as headings, "
            "paragraphs, links, and buttons.\n\n"
            "    <!doctype html>\n    <html lang=\"en\">\n    <head><meta charset=\"UTF-8\"><title>My page</title></head>\n"
            "    <body>\n      <h1>Hello, Bendigo AI!</h1>\n      <p>This is my first web page.</p>\n    </body>\n    </html>\n\n"
            "CSS controls appearance, while JavaScript adds behaviour."
        )

    if "css" in compact and ("what is" in compact or "explain" in compact):
        return (
            "CSS controls how HTML elements look and are laid out. For example:\n\n"
            "    body {\n      font-family: Arial, sans-serif;\n      background: #f4f4f4;\n    }\n"
            "    h1 {\n      color: #2457c5;\n    }\n\n"
            "The body rule styles the page, and the h1 rule styles headings. CSS can live in a separate .css file."
        )

    if "javascript" in compact and ("what is" in compact or "explain" in compact):
        return (
            "JavaScript adds behaviour to web pages, such as responding to button clicks.\n\n"
            "    document.getElementById(\"helloButton\").addEventListener(\"click\", () => {\n"
            "        document.getElementById(\"message\").textContent = \"Hello from Bendigo AI!\";\n    });\n\n"
            "This event listener runs the function when the button is clicked; the button and message elements must exist in the HTML."
        )

    if "error" in compact or "bug" in compact or "not working" in compact or "traceback" in compact:
        return (
            "I can help troubleshoot that. Please share the exact error message and the smallest relevant part of your code, "
            "and tell me what you expected to happen. Remove passwords, API keys, and other private details first. "
            "I'll help you check the likely cause step by step."
        )

    if any(word in compact for word in ("python", "html", "css", "javascript", "coding", "code", "program")):
        return (
            "I can help with this programming topic, but the full AI model is not connected right now, so I can't reliably "
            "generate a complete custom solution from that request alone. Please tell me the exact goal, language, and any "
            "error you see. For example: Write a Python calculator using two numbers."
        )

    if compact.endswith("?"):
        return (
            "I don't have a full language model connected yet, so I can't reliably answer every general question. "
            "I can currently explain several beginner programming topics and help debug code. For a more complete answer, "
            "Bendigo AI needs a reachable language-model service; this basic fallback is not the same as one."
        )

    return (
        "I received your message. I can currently help with a few common programming explanations and debugging guidance, "
        "but a full language model is not connected, so my answers to other topics are limited. Try asking about a Python "
        "variable, loop, function, list, HTML, CSS, or JavaScript, or share a coding error."
    )


def code_template(language: str, prompt: str) -> str:
    lang = language.lower().strip()
    safe_prompt = prompt.replace("*/", "* /")[:300]
    html_prompt = escape(safe_prompt)
    if lang in {"html", "html5"}:
        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bendigo Project</title>
</head>
<body>
  <main>
    <h1>Bendigo AI</h1>
    <p>{html_prompt}</p>
  </main>
</body>
</html>"""
    if lang == "css":
        return f"""/* Bendigo AI starter styles */
/* Request: {safe_prompt} */
:root {{ font-family: Arial, sans-serif; }}
body {{ margin: 0; min-height: 100vh; background: #050505; color: #fff; }}
main {{ max-width: 900px; margin: 0 auto; padding: 32px; }}"""
    if lang in {"javascript", "js"}:
        return f"""// Bendigo AI starter JavaScript
// Request: {safe_prompt}
document.addEventListener("DOMContentLoaded", () => {{
  console.log("Bendigo project ready");
}});"""
    if lang in {"python", "py"}:
        return f'''"""Bendigo AI Python starter.
Request: {safe_prompt}
"""

def main():
    print("Bendigo project ready")


if __name__ == "__main__":
    main()
'''
    return f"// Bendigo AI starter for {language}\n// Request: {safe_prompt}\n"


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "name": "Bendigo AI",
        "service": "backend",
        "status": "online",
        "version": APP_VERSION,
        "time": now_iso(),
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "bendigo-ai-backend",
        "version": APP_VERSION,
        "aiConfigured": ai_configured(),
        "aiModel": OLLAMA_MODEL if ollama_configured() else (AI_MODEL or "not configured"),
        "database": {
            "configured": database_configured(),
            "type": "postgresql" if database_configured() else "memory-fallback",
        },
        "github": {
            "connected": github_repository_accessible(),
            "writeEnabled": bool(GITHUB_TOKEN),
            "repository": GITHUB_REPO,
        },
        "features": {
            "chat": True,
            "webSearch": True,
            "codeGeneration": True,
            "githubRead": True,
            "githubWrite": bool(GITHUB_TOKEN),
        },
    }


@app.get("/api/db/status")
async def db_status():
    if not DATABASE_URL:
        return {"configured": False, "type": "memory-fallback", "persistent": False}
    try:
        with db_connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return {"configured": True, "type": "postgresql", "persistent": True, "status": "connected"}
    except Exception as exc:
        return {"configured": True, "type": "postgresql", "persistent": False, "status": "error", "error": str(exc)[:200]}


@app.get("/api/ai/status")
async def ai_status():
    ollama_status = probe_ollama() if ollama_configured() else {
        "status": "not_configured", "reachable": False, "modelAvailable": False
    }
    if ollama_configured():
        connection_status = ollama_status["status"]
    elif ai_gateway_configured():
        connection_status = "configured_not_verified"
    else:
        connection_status = "not_configured"
    return {
        "configured": ai_configured(),
        "connectionStatus": connection_status,
        "ollama": ollama_status,
        "provider": "ollama" if ollama_configured() else ("responses-api-compatible" if ai_gateway_configured() else None),
        "model": OLLAMA_MODEL if ollama_configured() else (AI_MODEL or None),
        "baseUrlConfigured": bool(OLLAMA_BASE_URL or AI_BASE_URL),
        "credentialConfigured": bool(AI_API_KEY),
        "browserSecretExposure": False,
        "note": (
            "A reachable Ollama server with the selected model is required."
            if not ai_configured() or (ollama_configured() and ollama_status["status"] != "ready")
            else "Configuration is present; successful generation is confirmed only by a chat request."
        ),
    }


@app.get("/api/test")
async def api_test():
    return {
        "success": True,
        "timestamp": now_iso(),
        "services": {
            "fastapi": True,
            "chat": True,
            "streaming": True,
            "webSearch": True,
            "codeGeneration": True,
            "githubRead": True,
            "githubWrite": bool(GITHUB_TOKEN),
            "aiModel": ai_configured(),
        },
    }


@app.get("/api/status")
async def status():
    return {
        "service": "Bendigo AI Backend",
        "status": "connected",
        "version": APP_VERSION,
        "time": now_iso(),
        "aiModel": OLLAMA_MODEL if ollama_configured() else (AI_MODEL or "not configured"),
        "aiConfigured": ai_configured(),
        "githubWrite": bool(GITHUB_TOKEN),
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    session_id = (request.sessionId or "default").strip()[:120] or "default"

    messages = db_get_history(session_id)
    model_reply = None
    model_error = False
    if ai_configured():
        try:
            model_reply = ai_model_reply(message, request.history or messages[:-1])
        except Exception:
            # Keep internal endpoint details out of the public response.
            model_error = True

    reply = model_reply or make_reply(message)
    db_add_messages(session_id, [
        {"role": "user", "content": message},
        {"role": "assistant", "content": reply},
    ])

    return {
        "success": True,
        "reply": reply,
        "sessionId": session_id,
        "timestamp": now_iso(),
        "model": (OLLAMA_MODEL if ollama_configured() else AI_MODEL) if model_reply else "bendigo-backend",
        "aiConfigured": ai_configured(),
        "modelUsed": bool(model_reply),
        "fallback": not bool(model_reply),
        "modelError": model_error,
        "notice": (
            "The AI model could not be reached; a basic fallback reply was used."
            if model_error else (
                "No AI model is configured; a basic fallback reply was used."
                if not ai_configured() else None
            )
        ),
    }


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    message = request.message.strip()
    session_id = (request.sessionId or "default").strip()[:120] or "default"

    async def events():
        messages = db_get_history(session_id)
        yield sse_event("start", json.dumps({
            "sessionId": session_id,
            "model": (OLLAMA_MODEL if ollama_configured() else AI_MODEL) if ai_configured() else "bendigo-backend",
        }))

        reply = None
        model_error = False
        if ai_configured():
            try:
                reply = ai_model_reply(message, request.history or messages[:-1])
            except Exception:
                model_error = True

        model_used = bool(reply)
        reply = reply or make_reply(message)
        db_add_messages(session_id, [
            {"role": "user", "content": message},
            {"role": "assistant", "content": reply},
        ])

        # Stream in small chunks so the UI can render an assistant-style response.
        for match in re.findall(r".{1,80}(?:\s+|$)", reply):
            if match:
                yield sse_event("token", match)
        yield sse_event("done", json.dumps({
            "success": True,
            "sessionId": session_id,
            "model": (OLLAMA_MODEL if ollama_configured() else AI_MODEL) if model_used else "bendigo-backend",
            "aiConfigured": ai_configured(),
            "modelUsed": model_used,
            "fallback": not model_used,
            "modelError": model_error,
            "notice": (
                "The AI model could not be reached; a basic fallback reply was used."
                if model_error else (
                    "No AI model is configured; a basic fallback reply was used."
                    if not ai_configured() else None
                )
            ),
        }))

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@app.get("/api/chat/history")
async def get_chat_history(sessionId: str = Query(default="default", max_length=120)):
    return {"success": True, "sessionId": sessionId, "messages": db_get_history(sessionId)}


@app.delete("/api/chat/history")
async def delete_chat_history(sessionId: str = Query(default="default", max_length=120)):
    db_delete_history(sessionId)
    return {"success": True, "sessionId": sessionId}


@app.post("/api/code")
async def code(request: CodeRequest):
    language = request.language.strip()
    prompt = request.prompt.strip()
    generated_code = None
    model_name = "bendigo-template-engine"

    if ai_configured():
        code_request = (
            f"Generate working {language} code for this request:\n{prompt}\n\n"
            "Return only the code, without Markdown fences or a long explanation. "
            "Use safe, non-destructive defaults and include brief comments where useful."
        )
        try:
            generated_code = ai_model_reply(code_request, [])
            if generated_code:
                generated_code = generated_code.strip()
                generated_code = re.sub(r"^\s*```[A-Za-z0-9_+-]*\s*\n", "", generated_code)
                generated_code = re.sub(r"\n```\s*$", "", generated_code).strip()
                model_name = OLLAMA_MODEL if ollama_configured() else AI_MODEL
        except Exception:
            generated_code = None

    used_model = bool(generated_code)
    return {
        "success": True,
        "language": language,
        "prompt": prompt,
        "code": generated_code or code_template(language, prompt),
        "status": "model_generated" if used_model else "template_fallback",
        "model": model_name,
        "modelUsed": used_model,
        "fallback": not used_model,
        "notice": (
            None if used_model else (
                "The configured AI model could not be reached; a starter template was returned."
                if ai_configured() else
                "No AI model is configured; a starter template was returned."
            )
        ),
    }


@app.get("/api/github/status")
async def github_status():
    connected = github_repository_accessible()
    return {
        "connected": connected,
        "repository": GITHUB_REPO,
        "branch": "main",
        "readAccess": connected,
        "writeEnabled": bool(GITHUB_TOKEN),
        "writeAccessConfigured": bool(GITHUB_TOKEN),
    }


@app.post("/api/github/branch")
async def github_branch(request: GithubBranchRequest):
    branch = request.branch.strip()
    if not re.fullmatch(r"[A-Za-z0-9._/-]{1,80}", branch) or branch in {"main", "master"}:
        return {"success": False, "error": "Choose a valid non-default branch name."}
    try:
        main_ref = github_request("GET", f"/repos/{GITHUB_REPO}/git/ref/heads/main")
        github_request(
            "POST",
            f"/repos/{GITHUB_REPO}/git/refs",
            {"ref": "refs/heads/" + branch, "sha": main_ref["object"]["sha"]},
        )
        return {"success": True, "branch": branch}
    except Exception as exc:
        return github_write_error(exc)


@app.post("/api/github/commit")
async def github_commit(request: GithubCommitRequest):
    branch = request.branch.strip()
    message = request.message.strip()
    files = {path.strip(): content for path, content in request.files.items() if path.strip()}

    if not branch or not message or not files:
        return {"success": False, "error": "Branch, commit message, and at least one file are required."}

    if any(not re.fullmatch(r"[A-Za-z0-9._/@+ -]{1,240}", path) for path in files):
        return {"success": False, "error": "One or more file paths are invalid."}

    try:
        ref = github_request("GET", f"/repos/{GITHUB_REPO}/git/ref/heads/{quote(branch, safe='')}")
        parent_sha = ref["object"]["sha"]
        parent = github_request("GET", f"/repos/{GITHUB_REPO}/git/commits/{parent_sha}")

        tree_items = []
        for path, content in files.items():
            if len(content.encode("utf-8")) > 1_000_000:
                return {"success": False, "error": f"{path} is too large for this operation."}
            blob = github_request(
                "POST",
                f"/repos/{GITHUB_REPO}/git/blobs",
                {"content": content, "encoding": "utf-8"},
            )
            tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})

        tree = github_request(
            "POST",
            f"/repos/{GITHUB_REPO}/git/trees",
            {"base_tree": parent["tree"]["sha"], "tree": tree_items},
        )
        commit = github_request(
            "POST",
            f"/repos/{GITHUB_REPO}/git/commits",
            {"message": message, "tree": tree["sha"], "parents": [parent_sha]},
        )
        github_request(
            "PATCH",
            f"/repos/{GITHUB_REPO}/git/refs/heads/{quote(branch, safe='')}",
            {"sha": commit["sha"], "force": False},
        )
        return {"success": True, "branch": branch, "commit": commit["sha"], "files": list(files.keys())}
    except Exception as exc:
        return github_write_error(exc)


@app.post("/api/github/pr")
async def github_pr(request: GithubPullRequestRequest):
    branch = request.branch.strip()
    title = request.title.strip()
    if not branch or not title:
        return {"success": False, "error": "Branch and pull request title are required."}
    try:
        pr = github_request(
            "POST",
            f"/repos/{GITHUB_REPO}/pulls",
            {"title": title, "head": branch, "base": "main", "body": request.body.strip()},
        )
        return {"success": True, "number": pr.get("number"), "url": pr.get("html_url"), "title": pr.get("title")}    except Exception as exc:
        return github_write_error(exc)


@app.get("/api/github/files")
async def github_files():
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents"
    request = Request(url, headers={"User-Agent": "Bendigo-AI", "Accept": "application/vnd.github+json"})
    try:
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        files = [
            {"name": item.get("name"), "type": item.get("type"), "url": item.get("html_url")}
            for item in data
        ]
        return {"success": True, "repository": GITHUB_REPO, "files": files}
    except Exception as exc:
        return {"success": False, "error": "GitHub repository could not be read.", "details": str(exc)[:500]}


@app.get("/api/search")
async def search(q: str = Query(min_length=1, max_length=500)):
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query cannot be blank.")

    url = "https://html.duckduckgo.com/html/?q=" + quote(query)
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Bendigo AI)",
        "Accept": "text/html",
    })

    try:
        with urlopen(request, timeout=12) as response:
            status = getattr(response, "status", 200)
            if status < 200 or status >= 300:
                raise RuntimeError("Unsuccessful search-provider response.")
            html = response.read().decode("utf-8", errors="ignore")

        if not html.strip():
            raise RuntimeError("Empty search-provider response.")

        results = []
        pattern = re.compile(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            re.IGNORECASE | re.DOTALL,
        )
        for match in pattern.finditer(html):
            result_url = unescape(match.group(1)).strip()
            title = clean_html(match.group(2))
            if result_url.startswith("//"):
                result_url = "https:" + result_url
            parsed_url = urlparse(result_url)
            if parsed_url.path.startswith("/l/") and parsed_url.netloc.endswith("duckduckgo.com"):
                destination = parse_qs(parsed_url.query).get("uddg", [""])[0]
                result_url = unquote(destination) if destination else ""
                parsed_url = urlparse(result_url)
            if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc or not title:
                continue

            snippet_match = re.search(
                r'class="result__snippet"[^>]*>(.*?)</(?:a|div)',
                html[match.end():match.end() + 5000],
                re.IGNORECASE | re.DOTALL,
            )
            snippet = clean_html(snippet_match.group(1)) if snippet_match else ""
            results.append({"title": title, "url": result_url, "snippet": snippet})
            if len(results) >= 8:
                break

        return {
            "success": True,
            "query": query,
            "results": results,
            "notice": None if results else "No usable search results were found. Try different keywords.",
            "timestamp": now_iso(),
        }
    except Exception:
        return {
            "success": False,
            "query": query,
            "results": [],
            "error": "Web search is temporarily unavailable. Please try again.",
            "timestamp": now_iso(),
        }