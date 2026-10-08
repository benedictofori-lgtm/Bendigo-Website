from datetime import datetime, timezone
from html import unescape
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen
import json
import os
import re
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


APP_VERSION = "1.2.0"
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

# Optional server-side AI model gateway.
# No model credential is ever sent to the browser.
AI_BASE_URL = os.getenv("AI_BASE_URL", "").strip().rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "").strip()
AI_API_KEY = os.getenv("AI_API_KEY", "").strip()


def ai_gateway_configured() -> bool:
    return bool(AI_BASE_URL and AI_MODEL)


def ai_model_reply(message: str, history: list[dict[str, Any]]):
    if not ai_gateway_configured():
        return None

    input_items = []
    for item in history[-20:]:
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
    text = message.strip()
    lower = text.lower()

    if lower in {"hello", "hi", "hey", "hello bendigo ai"}:
        return "Hello! I'm Bendigo AI. Your backend is online and ready for coding, learning, project planning, GitHub work, and web search."

    if lower in {"help", "what can you do", "what can you do?"}:
        return (
            "I can help with HTML, CSS, JavaScript and Python code, explain programming concepts, "
            "search the web, work with your GitHub workspace, plan projects, and manage Bendigo workspace data."
        )

    if "python" in lower:
        return "I can help you build Python projects, explain errors, write functions, and structure a project safely. Tell me what you want to build."

    if any(word in lower for word in ("html", "css", "javascript", "js")):
        return "I can help you build and debug HTML, CSS and JavaScript. Use Code Lab for a live browser preview, or describe the feature you want me to create."

    if "github" in lower:
        write_state = "write access is enabled" if GITHUB_TOKEN else "read access is available; secure write access still needs to be configured on Render"
        return f"Your Bendigo AI backend is connected to {GITHUB_REPO}. GitHub {write_state}."

    if "render" in lower or "backend" in lower:
        return "The Bendigo backend is running on Render with FastAPI. Health, status, chat, search, code, and GitHub endpoints are available."

    return (
        "I received your message. Bendigo's backend is online. For full ChatGPT/Gemini-style answers, "
        "the remaining backend component is a hosted language model; the API is structured so that model "
        "can be connected server-side without exposing credentials to the browser."
    )


def code_template(language: str, prompt: str) -> str:
    lang = language.lower().strip()
    safe_prompt = prompt.replace("*/", "* /")[:300]
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
    <p>{safe_prompt}</p>
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


@app.get("/")
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
        "aiConfigured": ai_gateway_configured(),
        "aiModel": AI_MODEL or "not configured",
        "github": {
            "connected": True,
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


@app.get("/api/ai/status")
async def ai_status():
    return {
        "configured": ai_gateway_configured(),
        "provider": "responses-api-compatible" if ai_gateway_configured() else None,
        "model": AI_MODEL or None,
        "baseUrlConfigured": bool(AI_BASE_URL),
        "credentialConfigured": bool(AI_API_KEY),
        "browserSecretExposure": False,
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
            "aiModel": ai_gateway_configured(),
        },
    }


@app.get("/api/status")
async def status():
    return {
        "service": "Bendigo AI Backend",
        "status": "connected",
        "version": APP_VERSION,
        "time": now_iso(),
        "aiModel": AI_MODEL or "not configured",
        "aiConfigured": ai_gateway_configured(),
        "githubWrite": bool(GITHUB_TOKEN),
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    session_id = (request.sessionId or "default").strip()[:120] or "default"

    messages = chat_history.setdefault(session_id, [])
    messages.append({"role": "user", "content": message})

    model_reply = None
    if ai_gateway_configured():
        try:
            model_reply = ai_model_reply(message, request.history or messages[:-1])
        except Exception as exc:
            model_reply = None

    reply = model_reply or make_reply(message)
    messages.append({"role": "assistant", "content": reply})
    chat_history[session_id] = messages[-40:]

    return {
        "success": True,
        "reply": reply,
        "sessionId": session_id,
        "timestamp": now_iso(),
        "model": AI_MODEL if model_reply else "bendigo-backend",
        "aiConfigured": ai_gateway_configured(),
    }


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    message = request.message.strip()
    session_id = (request.sessionId or "default").strip()[:120] or "default"

    async def events():
        messages = chat_history.setdefault(session_id, [])
        messages.append({"role": "user", "content": message})
        yield sse_event("start", json.dumps({
            "sessionId": session_id,
            "model": AI_MODEL if ai_gateway_configured() else "bendigo-backend",
        }))

        reply = None
        if ai_gateway_configured():
            try:
                reply = ai_model_reply(message, request.history or messages[:-1])
            except Exception:
                reply = None

        reply = reply or make_reply(message)
        messages.append({"role": "assistant", "content": reply})
        chat_history[session_id] = messages[-40:]

        # Stream in small chunks so the UI can render a real assistant-style response.
        for match in re.findall(r".{1,80}(?:\s+|$)", reply):
            if match:
                yield sse_event("token", match)
        yield sse_event("done", json.dumps({
            "success": True,
            "sessionId": session_id,
            "model": AI_MODEL if ai_gateway_configured() else "bendigo-backend",
            "aiConfigured": ai_gateway_configured(),
        }))

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@app.get("/api/chat/history")
async def get_chat_history(sessionId: str = Query(default="default", max_length=120)):
    return {"success": True, "sessionId": sessionId, "messages": chat_history.get(sessionId, [])}


@app.delete("/api/chat/history")
async def delete_chat_history(sessionId: str = Query(default="default", max_length=120)):
    chat_history.pop(sessionId, None)
    return {"success": True, "sessionId": sessionId}


@app.post("/api/code")
async def code(request: CodeRequest):
    return {
        "success": True,
        "language": request.language.strip(),
        "prompt": request.prompt.strip(),
        "code": code_template(request.language, request.prompt),
        "status": "generated",
        "model": "bendigo-template-engine",
    }


@app.get("/api/github/status")
async def github_status():
    return {
        "connected": True,
        "repository": GITHUB_REPO,
        "branch": "main",
        "writeEnabled": bool(GITHUB_TOKEN),
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
        return {"success": True, "number": pr.get("number"), "url": pr.get("html_url"), "title": pr.get("title")}
    except Exception as exc:
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
    url = "https://html.duckduckgo.com/html/?q=" + quote(query)
    request = Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Bendigo AI)", "Accept": "text/html"},
    )

    try:
        with urlopen(request, timeout=12) as response:
            html = response.read().decode("utf-8", errors="ignore")

        results = []
        pattern = re.compile(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            re.IGNORECASE | re.DOTALL,
        )
        for match in pattern.finditer(html):
            result_url = unescape(match.group(1))
            title = clean_html(match.group(2))
            if result_url.startswith("//"):
                result_url = "https:" + result_url
            if not title:
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

        return {"success": True, "query": query, "results": results, "timestamp": now_iso()}
    except Exception as exc:
        return {"success": False, "error": "Web search is temporarily unavailable.", "details": str(exc)[:500]}
