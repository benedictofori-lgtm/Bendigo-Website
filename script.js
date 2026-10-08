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

const fullscreenPreviewButton = $("fullscreenPreviewButton");
fullscreenPreviewButton?.addEventListener("click", () => {
  if (!codePreview) return;
  const active = codePreview.classList.toggle("code-preview-fullscreen");
  fullscreenPreviewButton.textContent = active ? "✕ Exit Fullscreen" : "⛶ Fullscreen";
  if (active) codePreview.scrollIntoView({ behavior: "smooth", block: "center" });
});



function createProjectPlan(idea) {
  const text = idea.toLowerCase();
  let type = "General project";
  let files = ["README.md", "project-notes.txt"];
  let steps = [
    "Define the goal and the main users.",
    "Break the idea into small features.",
    "Create the first working version.",
    "Test each feature and fix problems.",
    "Save the project and prepare it for GitHub."
  ];
  if (text.includes("website") || text.includes("web")) {
    type = "Website";
    files = ["index.html", "style.css", "script.js", "README.md"];
    steps = ["Plan the pages and user experience.", "Build the HTML structure.", "Create the responsive CSS design.", "Add JavaScript interactions.", "Test on desktop and mobile.", "Prepare the project for GitHub."];
  } else if (text.includes("game") || text.includes("racing") || text.includes("fighting")) {
    type = "Game";
    files = ["index.html", "style.css", "game.js", "assets/", "README.md"];
    steps = ["Define the game goal and controls.", "Create the game screen and player.", "Add movement, scoring, and game rules.", "Add levels, effects, and user feedback.", "Test gameplay and fix bugs.", "Package the game for sharing."];
  } else if (text.includes("python")) {
    type = "Python project";
    files = ["main.py", "requirements.txt", "README.md"];
    steps = ["Define the Python program's goal.", "Create the project structure.", "Build the main functions.", "Add input validation and error handling.", "Test the program with different cases.", "Document how to run it."];
  } else if (text.includes("design") || text.includes("ui") || text.includes("image")) {
    type = "Design project";
    files = ["design-brief.md", "assets/", "README.md"];
    steps = ["Define the visual goal and audience.", "Choose the layout and visual direction.", "Create the main screens or assets.", "Review spacing, readability, and consistency.", "Make the final refinements.", "Prepare the design for presentation."];
  }
  return {type, files, steps};
}

function renderProjectPlan() {
  const input = $("plannerInput");
  const result = $("plannerResult");
  if (!input || !result) return;
  const idea = input.value.trim();
  if (!idea) {
    result.hidden = false;
    result.innerHTML = "<h3>Tell me what you want to build first.</h3>";
    return;
  }
  const plan = createProjectPlan(idea);
  result.hidden = false;
  result.innerHTML = '<h3>' + plan.type + ' plan</h3><div class="plan-grid">' +
    plan.steps.map((step, index) => '<div class="plan-step"><b>STEP ' + (index + 1) + '</b><span>' + step + '</span></div>').join("") +
    '</div><div class="plan-files"><b>Suggested project structure:</b> ' + plan.files.join(" · ") + '</div>';
  localStorage.setItem("bendigoProjectPlan", JSON.stringify({idea, plan, savedAt:new Date().toISOString()}));
}

$("planProjectButton")?.addEventListener("click", renderProjectPlan);
$("plannerInput")?.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") renderProjectPlan();
});

function getProjectFiles() {
  const core = [
    {name:"index.html", type:"HTML", core:true},
    {name:"style.css", type:"CSS", core:true},
    {name:"script.js", type:"JavaScript", core:true}
  ];
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem("bendigoProjectFiles") || "[]"); } catch {}
  return core.concat(custom);
}

function saveProjectFiles(files) {
  const custom = files.filter(file => !file.core);
  localStorage.setItem("bendigoProjectFiles", JSON.stringify(custom));
}

function focusCoreFile(name) {
  const map = { "index.html": htmlCode, "style.css": cssCode, "script.js": jsCode };
  const editor = map[name];
  if (editor) {
    editor.focus();
    editor.scrollIntoView({behavior:"smooth", block:"center"});
  }
}

function renderWorkspaceFiles() {
  const box = $("workspaceFiles");
  if (!box) return;
  const files = getProjectFiles();
  box.innerHTML = "";
  files.forEach(file => {
    const row = document.createElement("div");
    row.className = "workspace-file";
    
    const main = document.createElement("div");
    main.className = "workspace-file-main";
    const name = document.createElement("b");
    name.textContent = file.name;
    const type = document.createElement("span");
    type.textContent = (file.type || "Text") + " file";
    main.append(name, type);
    main.addEventListener("click", () => {
      if (file.core) focusCoreFile(file.name);
      else {
        const content = prompt("Edit " + file.name + ":", file.content || "");
        if (content === null) return;
        const all = getProjectFiles();
        const target = all.find(item => item.name === file.name && !item.core);
        if (target) {
          target.content = content;
          target.updatedAt = new Date().toISOString();
          saveProjectFiles(all);
          renderWorkspaceFiles();
          if ($("fileExplorerStatus")) $("fileExplorerStatus").textContent = "Saved " + file.name;
        }
      }
    });

    const actions = document.createElement("div");
    actions.className = "workspace-file-actions";
    if (!file.core) {
      const rename = document.createElement("button");
      rename.type = "button";
      rename.textContent = "Rename";
      rename.addEventListener("click", event => {
        event.stopPropagation();
        const next = prompt("New file name:", file.name);
        if (!next?.trim()) return;
        const all = getProjectFiles();
        if (all.some(item => item.name === next.trim())) {
          alert("A file with that name already exists.");
          return;
        }
        const target = all.find(item => item.name === file.name && !item.core);
        if (target) target.name = next.trim();
        saveProjectFiles(all);
        renderWorkspaceFiles();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", event => {
        event.stopPropagation();
        if (!confirm("Delete " + file.name + "?")) return;
        saveProjectFiles(getProjectFiles().filter(item => item.name !== file.name));
        renderWorkspaceFiles();
        if ($("fileExplorerStatus")) $("fileExplorerStatus").textContent = "File deleted";
      });
      actions.append(rename, remove);
    }
    row.append(main, actions);
    box.appendChild(row);
  });
  const status = $("fileExplorerStatus");
  if (status) status.textContent = files.length + " project files";
}

$("newFileButton")?.addEventListener("click", () => {
  const name = prompt("New file name (example: README.md):");
  if (!name?.trim()) return;
  const cleanName = name.trim();
  const files = getProjectFiles();
  if (files.some(file => file.name === cleanName)) {
    alert("A file with that name already exists.");
    return;
  }
  const content = prompt("Optional starting content for " + cleanName + ":", "");
  if (content === null) return;
  const type = cleanName.endsWith(".html") ? "HTML" :
    cleanName.endsWith(".css") ? "CSS" :
    cleanName.endsWith(".js") ? "JavaScript" :
    cleanName.endsWith(".py") ? "Python" :
    cleanName.endsWith(".md") ? "Markdown" : "Text";
  files.push({name:cleanName, type, content, core:false, updatedAt:new Date().toISOString()});
  saveProjectFiles(files);
  renderWorkspaceFiles();
  if ($("fileExplorerStatus")) $("fileExplorerStatus").textContent = "Created " + cleanName;
});

$("refreshFilesButton")?.addEventListener("click", renderWorkspaceFiles);

function saveWorkspace() {
  const data = {
    html: htmlCode?.value || "",
    css: cssCode?.value || "",
    js: jsCode?.value || "",
    notes: $("projectNotes")?.value || "",
    savedAt: new Date().toISOString()
  };
  localStorage.setItem("bendigoCodeLab", JSON.stringify(data));
  const status = $("saveWorkspaceStatus");
  if (status) status.textContent = "Saved locally • " + new Date().toLocaleTimeString();
}

function loadWorkspace() {
  try {
    const data = JSON.parse(localStorage.getItem("bendigoCodeLab") || "null");
    if (!data) return;
    if (htmlCode && data.html) htmlCode.value = data.html;
    if (cssCode && data.css) cssCode.value = data.css;
    if (jsCode && data.js) jsCode.value = data.js;
    const notes = $("projectNotes");
    if (notes && typeof data.notes === "string") notes.value = data.notes;
    const status = $("saveWorkspaceStatus");
    if (status && data.savedAt) status.textContent = "Last saved • " + new Date(data.savedAt).toLocaleString();
  } catch (error) {
    console.warn("Saved workspace could not be loaded:", error);
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadProjectHtml() {
  const html = htmlCode?.value || "";
  const css = cssCode?.value || "";
  const js = jsCode?.value || "";
  const documentText = '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    css + '</style></head><body>' + html + '<script>' + js.replace(/<\\/script>/gi, "<\\\\/script>") +
    '<\\/script></body></html>';
  downloadFile("bendigo-project.html", documentText, "text/html");
}

$("saveWorkspaceButton")?.addEventListener("click", saveWorkspace);
$("downloadHtmlButton")?.addEventListener("click", downloadProjectHtml);
$("downloadCssButton")?.addEventListener("click", () => downloadFile("style.css", cssCode?.value || "", "text/css"));
$("downloadJsButton")?.addEventListener("click", () => downloadFile("script.js", jsCode?.value || "", "text/javascript"));
$("projectNotes")?.addEventListener("input", () => {
  clearTimeout(window._bendigoNotesTimer);
  window._bendigoNotesTimer = setTimeout(saveWorkspace, 700);
});

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
loadWorkspace();
renderWorkspaceFiles();
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
