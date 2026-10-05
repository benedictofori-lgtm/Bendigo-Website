const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const voiceButton = document.getElementById("voiceButton");
const voiceStatus = document.getElementById("voiceStatus");
const clearButton = document.getElementById("clearButton");
const newChatButton = document.getElementById("newChatButton");
const historyButton = document.getElementById("historyButton");
const settingsButton = document.getElementById("settingsButton");
const aboutButton = document.getElementById("aboutButton");
const runCodeButton = document.getElementById("runCodeButton");
const htmlCode = document.getElementById("htmlCode");
const cssCode = document.getElementById("cssCode");
const jsCode = document.getElementById("jsCode");
const codePreview = document.getElementById("codePreview");

const gameArea = document.getElementById("gameArea");
const playerCar = document.getElementById("playerCar");
const enemyCar = document.getElementById("enemyCar");
const gameScore = document.getElementById("gameScore");
const gameMessage = document.getElementById("gameMessage");
const startGameButton = document.getElementById("startGameButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");

const history = [];
let gameRunning = false;
let gameAnimation;
let enemyX = 0;
let enemyY = -80;
let playerX = 0;
let score = 0;
let lastTime = 0;

function addMessage(text, type) {
  const message = document.createElement("div");
  message.className = "message " + type;
  message.textContent = text;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-GH";
  speech.rate = 1;
  speech.pitch = 1;
  window.speechSynthesis.speak(speech);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(-10) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    addMessage(data.reply, "ai");
    history.push({ role: "assistant", content: data.reply });
    speak(data.reply);
  } catch (error) {
    console.error(error);
    addMessage("Sorry, Bendigo AI could not respond right now. Please try again.", "ai");
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send";
    input.focus();
  }
}

function startNewChat() {
  chat.innerHTML = "";
  history.length = 0;
  window.speechSynthesis.cancel();
  addMessage("New chat started! 👋 I'm Bendigo AI. How can I help?", "ai");
  input.focus();
}

function runCode() {
  const html = htmlCode.value;
  const css = cssCode.value.replace(/<\/style>/gi, "");
  const js = jsCode.value.replace(/<\/script>/gi, "");
  codePreview.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${html}<script>try{${js}}catch(error){document.body.insertAdjacentHTML("beforeend","<pre style='color:red;white-space:pre-wrap'>"+error.message+"</pre>")}<\/script></body></html>`;
}

function resetGame() {
  cancelAnimationFrame(gameAnimation);
  gameRunning = true;
  score = 0;
  lastTime = 0;
  playerX = (gameArea.clientWidth - 52) / 2;
  enemyX = Math.random() * Math.max(1, gameArea.clientWidth - 52);
  enemyY = -80;
  gameScore.textContent = "0";
  gameMessage.textContent = "";
  playerCar.style.left = playerX + "px";
  enemyCar.style.left = enemyX + "px";
  enemyCar.style.top = enemyY + "px";
  startGameButton.textContent = "🔄 Restart Race";
  gameArea.focus();
  gameAnimation = requestAnimationFrame(gameLoop);
}

function movePlayer(direction) {
  if (!gameRunning) return;
  playerX += direction * 28;
  playerX = Math.max(0, Math.min(gameArea.clientWidth - 52, playerX));
  playerCar.style.left = playerX + "px";
}

function gameLoop(timestamp) {
  if (!gameRunning) return;
  if (!lastTime) lastTime = timestamp;
  const delta = Math.min(40, timestamp - lastTime);
  lastTime = timestamp;

  enemyY += delta * 0.22;

  if (enemyY > gameArea.clientHeight) {
    enemyY = -80;
    enemyX = Math.random() * Math.max(1, gameArea.clientWidth - 52);
    score += 1;
    gameScore.textContent = String(score);
  }

  enemyCar.style.left = enemyX + "px";
  enemyCar.style.top = enemyY + "px";

  const playerLeft = playerX;
  const playerRight = playerX + 52;
  const playerTop = gameArea.clientHeight - 18 - 65;
  const playerBottom = gameArea.clientHeight - 18;
  const enemyLeft = enemyX;
  const enemyRight = enemyX + 52;
  const enemyTop = enemyY;
  const enemyBottom = enemyY + 65;

  const hit =
    playerLeft < enemyRight &&
    playerRight > enemyLeft &&
    playerTop < enemyBottom &&
    playerBottom > enemyTop;

  if (hit) {
    gameRunning = false;
    cancelAnimationFrame(gameAnimation);
    gameMessage.textContent = "💥 Game Over! Score: " + score;
    startGameButton.textContent = "🏁 Start Race";
    return;
  }

  gameAnimation = requestAnimationFrame(gameLoop);
}

startGameButton.addEventListener("click", resetGame);
leftButton.addEventListener("click", () => movePlayer(-1));
rightButton.addEventListener("click", () => movePlayer(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    movePlayer(-1);
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    movePlayer(1);
  }
  if (event.key === " " && document.activeElement === gameArea) {
    event.preventDefault();
    if (!gameRunning) resetGame();
  }
});

sendButton.addEventListener("click", sendMessage);
input.addEventListener("keydown", (event) => { if (event.key === "Enter") sendMessage(); });
newChatButton.addEventListener("click", startNewChat);
historyButton.addEventListener("click", () => addMessage("Chat History is stored only while this page is open. Your current conversation has " + history.length + " messages. 🕘", "ai"));
settingsButton.addEventListener("click", () => addMessage("Settings: 🎤 Voice input and 🔊 spoken replies are enabled. No API key is required.", "ai"));
aboutButton.addEventListener("click", () => addMessage("Bendigo AI is the assistant for the Bendigo Website. 🤖 It includes chat, math help, a coding playground, and Bendigo Racing.", "ai"));
runCodeButton.addEventListener("click", runCode);
clearButton.addEventListener("click", startNewChat);

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
    if (!input.value.trim()) voiceStatus.textContent = "";
  });
  recognition.addEventListener("error", () => {
    voiceButton.disabled = false;
    voiceStatus.textContent = "Voice input was not available. Please try again.";
  });
} else {
  voiceButton.disabled = true;
  voiceStatus.textContent = "Voice input is not supported by this browser.";
}

runCode();
