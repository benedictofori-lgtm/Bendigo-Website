const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const clearButton = document.getElementById("clearButton");

function addMessage(text, type) {
  const message = document.createElement("div");
  message.className = "message " + type;
  message.textContent = text;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

function getAIResponse(text) {
  const message = text.toLowerCase();

  if (message.includes("hello") || message.includes("hi")) {
    return "Hello! 👋 Welcome to Bendigo AI.";
  }

  if (message.includes("your name")) {
    return "My name is Bendigo AI. 🤖";
  }

  if (message.includes("how are you")) {
    return "I'm doing great! Thanks for asking. 😊";
  }

  if (message.includes("ghana")) {
    return "Ghana is a beautiful country in West Africa. 🇬🇭";
  }

  if (message.includes("game")) {
    return "I can help you build a game with Python, HTML, CSS and JavaScript! 🎮";
  }

  if (message.includes("website")) {
    return "Bendigo Website is my home! 🌐";
  }

  if (message.includes("help")) {
    return "Sure! Tell me what you want to learn or create.";
  }

  return "I'm still learning. Try asking me about games, websites, Ghana, or Python!";
}

function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  setTimeout(() => {
    addMessage(getAIResponse(text), "ai");
  }, 400);
}

sendButton.addEventListener("click", sendMessage);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

clearButton.addEventListener("click", () => {
  chat.innerHTML = "";
  addMessage("Chat cleared. Hello again! 👋", "ai");
});
