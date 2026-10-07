from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="Bendigo AI Backend",
    description="Backend API for the Bendigo AI workspace.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class CodeRequest(BaseModel):
    language: str
    prompt: str


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
    return {"status": "healthy", "service": "bendigo-ai-backend"}


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
        return {"success": False, "response": "Please enter a message."}

    return {
        "success": True,
        "response": f"Bendigo AI received: {message}",
    }


@app.post("/api/code")
async def code(request: CodeRequest):
    language = request.language.strip()
    prompt = request.prompt.strip()

    if not language or not prompt:
        return {
            "success": False,
            "message": "Language and prompt are required.",
        }

    return {
        "success": True,
        "language": language,
        "prompt": prompt,
        "status": "ready",
    }
