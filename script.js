const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const voiceButton = document.getElementById("voiceButton");
const voiceStatus = document.getElementById("voiceStatus");
const clearButton = document.getElementById("clearButton");

const history = [];

function addMessage(text, type) {
  const message = document.createElement("div");
  message.className = "message " + type;
  message.textContent = text;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  addMessage(text, "user");
  history.push({ role: "user", content: text });
  input.value = "";
  sendButton.disabled = true;
  sendButton.textContent = "Thinking...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        history: history.slice(-10)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    addMessage(data.reply, "ai");
    history.push({ role: "assistant", content: data.reply });
  } catch (error) {
    console.error(error);
    addMessage(
      "Sorry, Bendigo AI could not respond right now. Please try again.",
      "ai"
    );
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send";
    input.focus();
  }
}

sendButton.addEventListener("click", sendMessage);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-GH";
  recognition.interimResults = false;
  recognition.continuous = false;

  voiceButton.addEventListener("click", () => {
    recognition.start();
    voiceButton.disabled = true;
    voiceStatus.textContent = "Listening... 🎤";
  });

  recognition.addEventListener("result", (event) => {
    input.value = event.results[0][0].transcript;
    voiceStatus.textContent = "Voice captured. Click Send.";
  });

  recognition.addEventListener("end", () => {
    voiceButton.disabled = false;
    if (!input.value.trim()) {
      voiceStatus.textContent = "";
    }
  });

  recognition.addEventListener("error", () => {
    voiceButton.disabled = false;
    voiceStatus.textContent = "Voice input was not available. Please try again.";
  });
} else {
  voiceButton.disabled = true;
  voiceStatus.textContent = "Voice input is not supported by this browser.";
}

clearButton.addEventListener("click", () => {
  chat.innerHTML = "";
  history.length = 0;
  addMessage("Chat cleared. Hello again! 👋", "ai");
  input.focus();
});
