import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("."));

function getAIResponse(text, history = []) {
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

  if (message.includes("what can you do") || message.includes("what do you do")) {
    return "I can chat with you and help with Python, HTML, CSS, JavaScript, websites, games, and general questions. 🚀";
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
    return "Sure! 👍 Ask me about Python, JavaScript, HTML, CSS, websites, games, or Ghana.";
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

  return "I'm Bendigo AI. 🤖 I don't know that yet, but you can ask me about Python, websites, games, JavaScript, CSS, HTML, or Ghana.";
}

app.post("/api/chat", (req, res) => {
  const message = req.body?.message;
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

  res.json({ reply: getAIResponse(message, history) });
});

app.listen(port, () => {
  console.log(`Bendigo AI is running on port ${port}`);
});
