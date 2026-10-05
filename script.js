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

async function sendMessage() {
  const text = input.value.trim();

  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  sendButton.disabled = true;
  sendButton.textContent = "Thinking...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    addMessage(data.reply, "ai");
  } catch (error) {
    console.error(error);
    addMessage(
      "Sorry, Bendigo AI could not respond right now. The server may not be connected yet.",
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

clearButton.addEventListener("click", () => {
  chat.innerHTML = "";
  addMessage("Chat cleared. Hello again! 👋", "ai");
  input.focus();
});
