const $ = (id) => document.getElementById(id);

// Bendigo AI backend hosted on Render.
// Keep this URL on the server side for secrets; the browser only calls public API endpoints.
const BACKEND_URL = "https://bendigo-ai-backend.onrender.com";
const apiUrl = (path) => BACKEND_URL + path;

const chat = $("chat");
const input = $("userInput");
const sendButton = $("sendButton");
const typingIndicator = $("typingIndicator");
const voiceButton = $("voiceButton");
const voiceStatus = $("voiceStatus");
const clearButton = $("clearButton");
const newChatButton = $("newChatButton");
const dashboardButton = $("dashboardButton");
const startBuildingButton = $("startBuildingButton");
const openWorkspaceButton = $("openWorkspaceButton");
const newProjectButton = $("newProjectButton");
const projectGrid = $("projectGrid");
const runCodeButton = $("runCodeButton");
const htmlCode = $("htmlCode");
const cssCode = $("cssCode");
const jsCode = $("jsCode");
const codePreview = $("codePreview");

let sessionId = localStorage.getItem("bendigoSessionId");
if (!sessionId) {
  sessionId = crypto.randomUUID ? crypto.randomUUID() : "session-" + Date.now();
  localStorage.setItem("bendigoSessionId", sessionId);
}

function addMessage(text, role = "ai") {
  if (!chat) return;
  const el = document.createElement("div");
  el.className = "message " + role;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function setThinking(value) {
  if (typingIndicator) typingIndicator.style.display = value ? "flex" : "none";
  if (sendButton) sendButton.disabled = value;
}

async function performWebSearch(query) {
  const response = await fetch(apiUrl("/api/search?q=" + encodeURIComponent(query)));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Search failed.");
  if (!data.results?.length) return "🔎 I couldn't find search results for: " + query;
  return "🔎 Search results for: " + query + "\n\n" + data.results.map((r, i) => (i + 1) + ". " + r.title + "\n" + r.url).join("\n\n");
}

async function sendMessage(message = input?.value.trim()) {
  if (!message || !input || !chat) return;
  input.value = "";
  addMessage(message, "user");
  setThinking(true);

  try {
    const searchMatch = message.match(/^\s*(?:search(?: the web)?(?: for)?|look up)\s+(.+)/i);
    if (searchMatch) {
      addMessage(await performWebSearch(searchMatch[1].trim()), "ai");
      return;
    }
    const history = [...chat.querySelectorAll(".message")].slice(-10).map(el => ({
      role: el.classList.contains("user") ? "user" : "assistant",
      content: el.textContent
    }));

    const response = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ message, sessionId, history })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Bendigo AI could not respond.");
    addMessage(data.reply || "I received your message, but there was no response.", "ai");
  } catch (error) {
    addMessage("⚠️ " + error.message + " Check your Bendigo AI backend connection and try again.", "ai");
  } finally {
    setThinking(false);
    input.focus();
  }
}

sendButton?.addEventListener("click", () => sendMessage());
input?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt || "";
    input.focus();
  });
});

async function loadChatHistory() {
  try {
    const response = await fetch(apiUrl("/api/chat/history?sessionId=" + encodeURIComponent(sessionId)));
    if (!response.ok) return;
    const data = await response.json();
    if (data.messages?.length) {
      chat.innerHTML = "";
      data.messages.forEach(m => addMessage(m.content, m.role === "user" ? "user" : "ai"));
    }
  } catch (error) {
    console.warn("Chat history unavailable:", error);
  }
}

clearButton?.addEventListener("click", async () => {
  try {
    await fetch(apiUrl("/api/chat/history?sessionId=" + encodeURIComponent(sessionId)), {method: "DELETE"});
  } catch {}
  chat.innerHTML = '<div class="message ai">Chat cleared. 👋 What would you like to build?</div>';
});

function startNewChat() {
  sessionId = crypto.randomUUID ? crypto.randomUUID() : "session-" + Date.now();
  localStorage.setItem("bendigoSessionId", sessionId);
  if (chat) chat.innerHTML = '<div class="message ai">New Bendigo AI project chat ready. 🚀 What are we building?</div>';
  input?.focus();
}

newChatButton?.addEventListener("click", startNewChat);

function goToWorkspace(target) {
  const section = $(target);
  if (section) section.scrollIntoView({behavior: "smooth", block: "start"});
}

function setActiveNav(active) {
  document.querySelectorAll(".sidebar .side-link").forEach(button => button.classList.remove("active"));
  active?.classList.add("active");
}

document.querySelectorAll("[data-workspace-target]").forEach(button => {
  button.addEventListener("click", () => {
    goToWorkspace(button.dataset.workspaceTarget);
    setActiveNav(button);
  });
});

dashboardButton?.addEventListener("click", () => goToWorkspace("dashboard"));
startBuildingButton?.addEventListener("click", () => goToWorkspace("builder"));
openWorkspaceButton?.addEventListener("click", () => goToWorkspace("codeLab"));

(function setupWorkspaceNav() {
  const nav = document.querySelector(".sidebar-workspace-links");
  if (!nav) return;
  const makeNav = (label, target, icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "side-link";
    button.textContent = icon + " " + label;
    button.addEventListener("click", () => {
      goToWorkspace(target);
      setActiveNav(button);
      if (target === "github") refreshGithubWorkspace();
    });
    return button;
  };
  nav.append(
    makeNav("Search", "chat", "⌕"),
    makeNav("Learn", "chat", "◈")
  );
})();

document.querySelectorAll("[data-builder]").forEach(button => {
  button.addEventListener("click", () => {
    const type = button.dataset.builder;
    const prompts = {
      website: "Help me build a modern website with HTML, CSS and JavaScript.",
      game: "Help me code a game step by step. Do not play the game for me.",
      python: "Help me create a Python project step by step.",
      design: "Help me plan a visual design project."
    };
    input.value = prompts[type] || "Help me build a project.";
    goToWorkspace("chat");
    input.focus();
  });
});

function loadProjects() {
  if (!projectGrid) return;
  let projects = [];
  try { projects = JSON.parse(localStorage.getItem("bendigoProjects") || "[]"); } catch {}
  if (!projects.length) {
    projects = [
      {name: "Bendigo AI Website", type: "Web project"},
      {name: "Code Adventures", type: "Game project"},
      {name: "Python Learning", type: "Python project"}
    ];
    localStorage.setItem("bendigoProjects", JSON.stringify(projects));
  }
  projectGrid.innerHTML = "";
  projects.forEach(project => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = "<strong></strong><small></small>";
    card.querySelector("strong").textContent = project.name;
    card.querySelector("small").textContent = project.type;
    projectGrid.appendChild(card);
  });
}

newProjectButton?.addEventListener("click", () => {
  const name = prompt("Project name:");
  if (!name?.trim()) return;
  let projects = [];
  try { projects = JSON.parse(localStorage.getItem("bendigoProjects") || "[]"); } catch {}
  projects.unshift({name: name.trim(), type: "New project"});
  localStorage.setItem("bendigoProjects", JSON.stringify(projects.slice(0, 12)));
  loadProjects();
  updateProjectStat();
});

function runCode() {
  if (!codePreview || !htmlCode || !cssCode || !jsCode) return;
  const html = htmlCode.value;
  const css = cssCode.value.replace(/<\\/style>/gi, "<\\\\/style>");
  const js = jsCode.value.replace(/<\\/script>/gi, "<\\\\/script>");
  codePreview.srcdoc = `<!doctype html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${html}<script>${js}<\\/script></body></html>`;
}

runCodeButton?.addEventListener("click", runCode);
[htmlCode, cssCode, jsCode].forEach(editor => editor?.addEventListener("input", () => {
  clearTimeout(editor._bendigoTimer);
  editor._bendigoTimer = setTimeout(runCode, 500);
}));

let recognition = null;
if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechAPI();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.onstart = () => { if (voiceStatus) voiceStatus.textContent = "Listening…"; };
  recognition.onresult = event => {
    input.value = event.results[0][0].transcript;
    voiceStatus.textContent = "Ready to send.";
    input.focus();
  };
  recognition.onerror = () => { voiceStatus.textContent = "Microphone could not be used."; };
  recognition.onend = () => { if (voiceStatus?.textContent === "Listening…") voiceStatus.textContent = ""; };
}
voiceButton?.addEventListener("click", () => {
  if (!recognition) {
    voiceStatus.textContent = "Voice input is not supported by this browser.";
    return;
  }
  recognition.start();
});

async function refreshGithubWorkspace() {
  const box = $("githubFiles");
  const status = $("githubSyncStatus");
  const branchName = $("githubBranchName");
  if (status) status.textContent = "Syncing…";
  try {
    const [statusResponse, filesResponse] = await Promise.all([
      fetch(apiUrl("/api/github/status")),
      fetch(apiUrl("/api/github/files"))
    ]);
    const repoData = await statusResponse.json();
    const filesData = await filesResponse.json();
    if (!statusResponse.ok || !filesResponse.ok) throw new Error(repoData.error || filesData.error || "GitHub sync failed.");
    if (branchName) branchName.textContent = repoData.branch || "main";
    if (status) status.textContent = repoData.writeEnabled ? "Synced • write access ready" : "Synced • read-only";
    const mode = $("githubConnectionMode");
    if (mode) mode.textContent = repoData.writeEnabled ? "CONNECTED" : "READ-ONLY";
    const bottomGithub = $("bottomGithubStatus");
    if (bottomGithub) bottomGithub.textContent = repoData.writeEnabled ? "CONNECTED" : "READ-ONLY";
    ["githubBranchButton","githubCommitButton","githubPrButton"].forEach(id => { const button = $(id); if (button) button.disabled = !repoData.writeEnabled; });
    if (box) {
      box.innerHTML = "";
      (filesData.files || []).filter(file => file.type === "file").forEach(file => {
        const row = document.createElement("div");
        row.className = "github-file";
        const link = document.createElement("a");
        link.href = file.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = file.name;
        row.appendChild(link);
        box.appendChild(row);
      });
      if (!box.children.length) box.textContent = "No repository files found.";
    }
  } catch (error) {
    if (status) status.textContent = "Sync failed";
    const bottomGithub = $("bottomGithubStatus");
    if (bottomGithub) bottomGithub.textContent = "CHECK FAILED";
    if (box) box.textContent = "GitHub sync could not be completed. Check your internet connection.";
    console.error(error);
  }
}

$("githubSyncButton")?.addEventListener("click", refreshGithubWorkspace);
$("githubBranchButton")?.addEventListener("click", () => {
  const name = prompt("New branch name:");
  if (name?.trim()) addMessage("GitHub branch request saved: " + name.trim() + ". Branch creation needs a secure GitHub write connection.", "ai");
});
$("githubCommitButton")?.addEventListener("click", () => {
  addMessage("GitHub commit action is ready for a secure write connection. Your browser should never contain a GitHub token.", "ai");
});
$("githubPrButton")?.addEventListener("click", () => {
  addMessage("Pull request action is ready for a secure GitHub connection.", "ai");
});

async function checkSystemHealth() {
  try {
    const response = await fetch(apiUrl("/api/health"));
    const data = await response.json();
    const ai = $("statAI");
    const aiSub = $("statAISub");
    if (ai) ai.textContent = data.aiConfigured ? "READY" : "LOCAL";
    if (aiSub) aiSub.textContent = data.aiConfigured ? "AI service connected" : "Built-in fallback";
    if (data.github?.connected) {
      const g = $("statGithub");
      const gs = $("statGithubSub");
      if (g) g.textContent = data.github.writeEnabled ? "CONNECTED" : "READ-ONLY";
      if (gs) gs.textContent = data.github.writeEnabled ? "Write access ready" : "Public repository sync";
    }
  } catch {
    const ai = $("statAI");
    if (ai) ai.textContent = "OFFLINE";
  }
}

function updateProjectStat() {
  try {
    const projects = JSON.parse(localStorage.getItem("bendigoProjects") || "[]");
    const stat = $("statProjects");
    if (stat) stat.textContent = projects.length || 0;
  } catch {}
}

loadProjects();
updateProjectStat();
loadChatHistory();
runCode();
refreshGithubWorkspace();
checkSystemHealth();


// Bendigo AI bottom navigation and quick actions.
// Each action uses a real workspace section or the existing project/chat controls.
function setupBottomWorkspaceNav() {
  document.querySelectorAll("[data-bottom-target]").forEach(button => {
    button.addEventListener("click", () => {
      const target = $(button.dataset.bottomTarget);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (button.dataset.bottomTarget === "github") refreshGithubWorkspace();
    });
  });

  document.querySelectorAll("[data-bottom-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.bottomAction;
      if (action === "new-project") {
        goToWorkspace("projects");
        newProjectButton?.click();
      } else if (action === "open-code") {
        goToWorkspace("codeLab");
        htmlCode?.focus();
      } else if (action === "search") {
        goToWorkspace("chat");
        if (input) {
          input.placeholder = "Ask Bendigo AI, or type: search for your topic...";
          input.focus();
        }
      } else if (action === "build") {
        goToWorkspace("builder");
      }
    });
  });
}
setupBottomWorkspaceNav();
