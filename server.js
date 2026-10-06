import express from "express";
import OpenAI from "openai";
import Database from "better-sqlite3";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

const db = new Database("bendigo.db");
db.pragma("journal_mode = WAL");
db.exec("CREATE TABLE IF NOT EXISTS conversations (session_id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_chats_session ON chats(session_id, id); CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);");
const saveMessage = db.prepare("INSERT INTO chats (session_id, role, content) VALUES (?, ?, ?)");
const getMessages = db.prepare("SELECT role, content, created_at FROM chats WHERE session_id = ? ORDER BY id ASC LIMIT 100");
const clearMessages = db.prepare("DELETE FROM chats WHERE session_id = ?");
const createConversation = db.prepare("INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, ?)");
const updateConversation = db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?");
const getConversations = db.prepare("SELECT session_id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50");
const deleteConversation = db.prepare("DELETE FROM conversations WHERE session_id = ?");

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const AI_INSTRUCTIONS = "You are Bendigo AI, a friendly and helpful assistant inside the Bendigo Website. Explain things clearly for a young learner, especially coding, websites, games, school subjects, creativity, and general questions. Be honest when you do not know something. Never claim to have performed an action you cannot perform.";

function calculate(expression) {
  const cleaned = expression
    .replace(/,/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^0-9+\-*/().% ]/g, "")
    .trim();

  if (!cleaned || !/[0-9]/.test(cleaned)) return null;

  try {
    const result = Function("\"use strict\"; return (" + cleaned + ")")();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function getAIResponse(text, history = []) {
  const original = text.trim();
  const message = original.toLowerCase();

  const calculationText = message
    .replace(/^\s*(calculate|calc|what is|what's)\s+/i, "")
    .replace(/[?=]+$/g, "")
    .trim();

  if (/^(calculate|calc|what is|what's)\s+[-+*/().%\d\s×÷,]+$/i.test(original)) {
    const result = calculate(calculationText);
    if (result !== null) return "🧮 The answer is " + result;
  }

  if (/^[-+*/().%\d\s×÷,]+$/.test(original)) {
    const result = calculate(original);
    if (result !== null) return "🧮 The answer is " + result;
  }

  if (/^(hi|hello|hey)\b/.test(message)) {
    return "Hello! 👋 I'm Bendigo AI. How can I help you?";
  }

  if (message.includes("your name")) {
    return "My name is Bendigo AI. 🤖";
  }

  if (message.includes("who made you") || message.includes("who created you")) {
    return "I'm Bendigo AI, created for the Bendigo Website. 🌐";
  }

  if (message.includes("how are you")) {
    return "I'm doing great! 😊 Thanks for asking.";
  }

  if (message.includes("what can you do") || message.includes("what do you do")) {
    return "I can chat with you, calculate math, and help with Python, HTML, CSS, JavaScript, websites, games, and general questions. 🚀";
  }

  if (message.includes("calculator") || message.includes("calculate")) {
    return "🧮 Sure! Type something like 25 + 17, 100 / 4, or (8 * 6) - 5.";
  }

  if (message.includes("ghana")) {
    return "Ghana is a beautiful country in West Africa. 🇬🇭 I can also help you learn about Ghanaian culture, places, and history.";
  }

  if (message.includes("python")) {
    return "Python is a beginner-friendly programming language. 🐍 I can help you build programs and games step by step.";
  }

  if (message.includes("javascript")) {
    return "JavaScript makes websites interactive. 💻 I can help you create buttons, games, animations, and other features.";
  }

  if (message.includes("html")) {
    return "HTML creates the structure of a website. 🌐 For example, headings, buttons, images, and text.";
  }

  if (message.includes("css")) {
    return "CSS controls how a website looks. 🎨 It can change colors, spacing, layouts, fonts, and animations.";
  }

  if (message.includes("code") || message.includes("coding")) {
    return "💻 I can help with Python, JavaScript, HTML, and CSS. Tell me what you want your code to do.";
  }

  if (message.includes("game")) {
    return "Yes! 🎮 I can help you build racing, fighting, adventure, puzzle, and other games.";
  }

  if (message.includes("website")) {
    return "You're using the Bendigo Website! 🌐 We can keep adding features to it.";
  }

  if (message.includes("how do i") || message.includes("how can i")) {
    return "Tell me exactly what you want to create, and I'll break it into simple steps. 👍";
  }

  if (message.includes("help")) {
    return "Sure! 👍 Try a math problem, or ask me about Python, JavaScript, HTML, CSS, websites, games, or Ghana.";
  }

  if (message.includes("thank")) {
    return "You're welcome! 😊";
  }

  if (message.includes("bye")) {
    return "Goodbye! 👋 Come back anytime.";
  }

  if (history.length > 0) {
    return "I remember that we've been chatting. 🧠 Tell me a little more about what you mean, and I'll try to help.";
  }

  return "I'm Bendigo AI. 🤖 I don't know that yet, but you can ask me about math, Python, websites, games, JavaScript, CSS, HTML, or Ghana.";
}

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;
  const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim() ? req.body.sessionId.trim().slice(0, 100) : null;
  if (!sessionId) return res.status(400).json({ error: "A chat session is required." });
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

  createConversation.run(sessionId, message.trim().replace(/\s+/g, " ").slice(0, 48) || "New chat");
  updateConversation.run(sessionId);
  saveMessage.run(sessionId, "user", message);

  if (openai) {
    try {
      const input = [...history, { role: "user", content: message }]
        .slice(-12)
        .map(item => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content ?? item.message ?? "") }))
        .filter(item => item.content.trim());

      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        instructions: AI_INSTRUCTIONS,
        input
      });

      const reply = response.output_text || "I couldn't generate a response right now.";
      saveMessage.run(sessionId, "assistant", reply);
      updateConversation.run(sessionId);
      return res.json({ reply });
    } catch (error) {
      console.error("Bendigo AI service error:", error.message);
      const fallback = getAIResponse(message, history);
      saveMessage.run(sessionId, "assistant", fallback);
      updateConversation.run(sessionId);
      return res.json({ reply: fallback, aiService: false });
    }
  }

  const reply = getAIResponse(message, history);
  saveMessage.run(sessionId, "assistant", reply);
  res.json({ reply });
});


// GitHub workspace: read-only repository sync for the connected Bendigo project.
// A future GitHub OAuth/App connection can replace these public API calls for private repos.
const GITHUB_REPO = process.env.GITHUB_REPO || "benedictofori-lgtm/Bendigo-website";

app.get("/api/github/status", async (req, res) => {
  try {
    const response = await fetch("https://api.github.com/repos/" + GITHUB_REPO, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "Bendigo-AI" }
    });
    if (!response.ok) return res.status(response.status).json({ error: "GitHub repository could not be reached." });
    const repoData = await response.json();
    res.json({
      connected: true,
      repository: repoData.full_name,
      branch: repoData.default_branch,
      private: Boolean(repoData.private),
      url: repoData.html_url
    });
  } catch (error) {
    console.error("GitHub status error:", error.message);
    res.status(502).json({ connected: false, error: "GitHub is not reachable right now." });
  }
});

app.get("/api/github/files", async (req, res) => {
  try {
    const response = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents", {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "Bendigo-AI" }
    });
    if (!response.ok) return res.status(response.status).json({ error: "GitHub files could not be loaded." });
    const items = await response.json();
    const files = Array.isArray(items) ? items.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      url: item.html_url
    })) : [];
    res.json({ repository: GITHUB_REPO, files });
  } catch (error) {
    console.error("GitHub files error:", error.message);
    res.status(502).json({ error: "GitHub files could not be loaded right now." });
  }
});

app.listen(port, () => {
  console.log(`Bendigo AI is running on port ${port}`);
});

app.get("/api/chat/conversations", (req, res) => { res.json({ conversations: getConversations.all() }); });
app.delete("/api/chat/conversations/:sessionId", (req, res) => { const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId.trim().slice(0, 100) : ""; if (!sessionId) return res.status(400).json({ error: "A chat session is required." }); clearMessages.run(sessionId); deleteConversation.run(sessionId); res.json({ ok: true }); });
app.get("/api/chat/history", (req, res) => { const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim().slice(0, 100) : ""; if (!sessionId) return res.status(400).json({ error: "A chat session is required." }); res.json({ messages: getMessages.all(sessionId) }); });
app.delete("/api/chat/history", (req, res) => { const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim().slice(0, 100) : ""; if (!sessionId) return res.status(400).json({ error: "A chat session is required." }); clearMessages.run(sessionId); res.json({ ok: true }); });
