import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

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
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

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

      return res.json({ reply: response.output_text || "I couldn't generate a response right now." });
    } catch (error) {
      console.error("Bendigo AI error:", error.message);
      return res.status(502).json({ error: "Bendigo AI could not reach the AI service. Check the server API configuration." });
    }
  }

  res.json({ reply: getAIResponse(message, history) });
});

app.listen(port, () => {
  console.log(`Bendigo AI is running on port ${port}`);
});
