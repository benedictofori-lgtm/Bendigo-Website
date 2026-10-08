from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen
import json
import os
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="Bendigo AI Backend",
    description="Backend API for the Bendigo AI workspace.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    sessionId: str | None = None
    history: list[dict] = []


class CodeRequest(BaseModel):
    language: str
    prompt: str


chat_history: dict[str, list[dict]] = {}

GITHUB_REPO = "benedictofori-lgtm/Bendigo-website"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()

class GithubBranchRequest(BaseModel):
    branch: str

class GithubCommitRequest(BaseModel):
    branch: str
    message: str
    files: dict[str, str]

class GithubPullRequestRequest(BaseModel):
    branch: str
    title: str
    body: str = ""

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
    return {"success": False, "error": "GitHub write operation failed.", "details": str(exc)}



def make_reply(message: str) -> str:
    text = message.strip()
    lower = text.lower()

    if lower in {"hello", "hi", "hey", "hello bendigo ai"}:
        return "Hello! I'm Bendigo AI. I'm connected to the Render backend and ready to help you build, code, learn, and search."

    if "python" in lower:
        return "I can help you build Python projects step by step. Tell me what you want to create, and I'll help with the code and explain it."

    if "html" in lower or "css" in lower or "javascript" in lower:
        return "I can help you build and debug HTML, CSS, and JavaScript projects. Send me the feature or error you want to work on."

    if "github" in lower:
        return "Your Bendigo AI backend is connected to the Bendigo-website repository on GitHub. I can help you work with the project structure and code."

    return (
        "Bendigo AI is connected successfully. I received your message and can help "
        "with coding, learning, project planning, and troubleshooting. "
        "For deeper AI answers, the next step is to connect a model service securely on the backend."
    )


@app.get("/")
async def root():
    return {
        "name": "Bendigo AI",
        "service": "backend",
        "status": "online",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "bendigo-ai-backend",
        "aiConfigured": False,
        "github": {
            "connected": True,
            "writeEnabled": False,
        },
    }


@app.get("/api/status")
async def status():
    return {
        "service": "Bendigo AI Backend",
        "status": "connected",
        "version": app.version,
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        return {"success": False, "reply": "Please enter a message."}

    session_id = request.sessionId or "default"
    messages = chat_history.setdefault(session_id, [])
    messages.append({"role": "user", "content": message})

    reply = make_reply(message)
    messages.append({"role": "assistant", "content": reply})
    chat_history[session_id] = messages[-20:]

    return {
        "success": True,
        "reply": reply,
        "sessionId": session_id,
    }


@app.get("/api/chat/history")
async def get_chat_history(sessionId: str = "default"):
    return {"success": True, "messages": chat_history.get(sessionId, [])}


@app.delete("/api/chat/history")
async def delete_chat_history(sessionId: str = "default"):
    chat_history.pop(sessionId, None)
    return {"success": True}


@app.post("/api/code")
async def code(request: CodeRequest):
    language = request.language.strip()
    prompt = request.prompt.strip()

    if not language or not prompt:
        return {"success": False, "message": "Language and prompt are required."}

    return {
        "success": True,
        "language": language,
        "prompt": prompt,
        "status": "ready",
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
        github_request("POST", f"/repos/{GITHUB_REPO}/git/refs", {"ref": "refs/heads/" + branch, "sha": main_ref["object"]["sha"]})
        return {"success": True, "branch": branch}
    except Exception as exc:
        return github_write_error(exc)

@app.post("/api/github/commit")
async def github_commit(request: GithubCommitRequest):
    branch, message = request.branch.strip(), request.message.strip()
    files = {path.strip(): content for path, content in request.files.items() if path.strip()}
    if not branch or not message or not files:
        return {"success": False, "error": "Branch, commit message, and at least one file are required."}
    try:
        ref = github_request("GET", f"/repos/{GITHUB_REPO}/git/ref/heads/{quote(branch, safe='')}")
        parent_sha = ref["object"]["sha"]
        parent = github_request("GET", f"/repos/{GITHUB_REPO}/git/commits/{parent_sha}")
        tree_items = []
        for path, content in files.items():
            blob = github_request("POST", f"/repos/{GITHUB_REPO}/git/blobs", {"content": content, "encoding": "utf-8"})
            tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        tree = github_request("POST", f"/repos/{GITHUB_REPO}/git/trees", {"base_tree": parent["tree"]["sha"], "tree": tree_items})
        commit = github_request("POST", f"/repos/{GITHUB_REPO}/git/commits", {"message": message, "tree": tree["sha"], "parents": [parent_sha]})
        github_request("PATCH", f"/repos/{GITHUB_REPO}/git/refs/heads/{quote(branch, safe='')}", {"sha": commit["sha"], "force": False})
        return {"success": True, "branch": branch, "commit": commit["sha"], "files": list(files.keys())}
    except Exception as exc:
        return github_write_error(exc)

@app.post("/api/github/pr")
async def github_pr(request: GithubPullRequestRequest):
    branch, title = request.branch.strip(), request.title.strip()
    if not branch or not title:
        return {"success": False, "error": "Branch and pull request title are required."}
    try:
        pr = github_request("POST", f"/repos/{GITHUB_REPO}/pulls", {"title": title, "head": branch, "base": "main", "body": request.body.strip()})
        return {"success": True, "number": pr.get("number"), "url": pr.get("html_url"), "title": pr.get("title")}
    except Exception as exc:
        return github_write_error(exc)


@app.get("/api/github/files")
async def github_files():
    url = "https://api.github.com/repos/benedictofori-lgtm/Bendigo-website/contents"
    request = Request(url, headers={"User-Agent": "Bendigo-AI"})
    try:
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
        files = [
            {
                "name": item.get("name"),
                "type": item.get("type"),
                "url": item.get("html_url"),
            }
            for item in data
        ]
        return {"success": True, "files": files}
    except Exception as exc:
        return {"success": False, "error": "GitHub repository could not be read.", "details": str(exc)}


@app.get("/api/search")
async def search(q: str):
    query = q.strip()
    if not query:
        return {"success": False, "error": "Search query is required."}

    url = "https://html.duckduckgo.com/html/?q=" + quote(query)
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Bendigo AI)",
            "Accept": "text/html",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            html = response.read().decode("utf-8", errors="ignore")

        results = []
        for match in re.finditer(
            r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            html,
            re.IGNORECASE | re.DOTALL,
        ):
            result_url = match.group(1)
            title = re.sub(r"<.*?>", "", match.group(2))
            title = title.replace("&amp;", "&").strip()
            results.append({"title": title, "url": result_url})
            if len(results) >= 8:
                break

        return {"success": True, "query": query, "results": results}
    except Exception as exc:
        return {"success": False, "error": "Web search is temporarily unavailable.", "details": str(exc)}
