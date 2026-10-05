import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

function getAIResponse(text) {
  const message = text.toLowerCase().trim();

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

  if (message.includes("ghana")) {
    return "Ghana is a beautiful country in West Africa. 🇬🇭";
  }

  if (message.includes("python")) {
    return "Python is a beginner-friendly programming language. I can help you learn it step by step. 🐍";
  }

  if (message.includes("javascript") || message.includes("html") || message.includes("css")) {
    return "I can help you build websites with HTML, CSS, and JavaScript. 💻";
  }

  if (message.includes("game")) {
    return "Yes! 🎮 I can help you build racing, fighting, adventure, and other games.";
  }

  if (message.includes("website")) {
    return "You're using the Bendigo Website! 🌐 I can help you improve it.";
  }

  if (message.includes("help")) {
    return "Sure! Try asking me about Python, JavaScript, websites, games, or Ghana.";
  }

  if (message.includes("thank")) {
    return "You're welcome! 😊";
  }

  if (message.includes("bye")) {
    return "Goodbye! 👋 Come back anytime.";
  }

  return "I'm Bendigo AI. 🤖 I don't know that yet, but you can ask me about Python, websites, games, JavaScript, CSS, HTML, or Ghana.";
}

app.post("/api/chat", (req, res) => {
  const message = req.body?.message;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

  res.json({ reply: getAIResponse(message) });
});

app.listen(port, () => {
  console.log(`Bendigo AI is running on port ${port}`);
});
