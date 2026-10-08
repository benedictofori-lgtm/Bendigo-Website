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
  if (!data.results?.length) return {text: "No search results found for: " + query, results: []};
  return {text: "Search results for: " + query, results: data.results};
}

function addSearchResults(query, results) {
  if (!chat) return;
  const wrap = document.createElement("div");
  wrap.className = "message ai search-results";
  const heading = document.createElement("strong");
  heading.textContent = "Search results for: " + query;
  wrap.appendChild(heading);

  results.forEach((result, index) => {
    const card = document.createElement("a");
    card.className = "search-result-card";
    card.href = result.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const number = document.createElement("span");
    number.className = "search-result-number";
    number.textContent = String(index + 1);

    const content = document.createElement("span");
    content.className = "search-result-content";

    const title = document.createElement("strong");
    title.textContent = result.title || result.url;

    const url = document.createElement("small");
    url.textContent = result.url;

    const snippet = document.createElement("p");
    snippet.textContent = result.snippet || "Open this result to view the source.";

    content.append(title, url, snippet);
    card.append(number, content);
    wrap.appendChild(card);
  });

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage(message = input?.value.trim()) {
  if (!message || !input || !chat) return;
  input.value = "";
  addMessage(message, "user");
  setThinking(true);

  try {
    const searchMatch = message.match(/^\s*(?:search(?: the web)?(?: for)?|look up)\s+(.+)/i);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      const searchData = await performWebSearch(query);
      if (searchData.results.length) addSearchResults(query, searchData.results);
      else addMessage(searchData.text, "ai");
      return;
    }

    const history = [...chat.querySelectorAll(".message")].slice(-10).map(el => ({
      role: el.classList.contains("user") ? "user" : "assistant",
      content: el.textContent
    }));

    const response = await fetch(apiUrl("/api/chat/stream"), {
      method: "POST",
      headers: {"Content-Type": "application/json", "Accept": "text/event-stream"},
      body: JSON.stringify({message, sessionId, history})
    });

    if (!response.ok || !response.body) {
      throw new Error("Bendigo AI could not start the response stream.");
    }

    const aiMessage = document.createElement("div");
    aiMessage.className = "message ai";
    chat.appendChild(aiMessage);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        const dataLines = rawEvent.split("\n").filter(line => line.startsWith("data: "));
        const eventName = (rawEvent.match(/^event:\s*(.+)$/m) || [,""])[1];
        const data = dataLines.map(line => line.slice(6)).join("\n");
        if (eventName === "token") {
          aiMessage.textContent += data;
          chat.scrollTop = chat.scrollHeight;
        }
      }
    }

    if (!aiMessage.textContent.trim()) {
      aiMessage.textContent = "I received your message, but there was no response.";
    }
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
  const name = prompt("Project name:");
  if (!name?.trim()) return;
  let projects = [];
  try { projects = JSON.parse(localStorage.getItem("bendigoProjects") || "[]"); } catch {}
  const projectName = name.trim();
  projects.unshift({name: projectName, type: "New project", createdAt: new Date().toISOString()});
  localStorage.setItem("bendigoProjects", JSON.stringify(projects.slice(0, 12)));
  loadProjects();
  updateProjectStat();
  sessionId = crypto.randomUUID ? crypto.randomUUID() : "session-" + Date.now();
  localStorage.setItem("bendigoSessionId", sessionId);
  if (chat) chat.innerHTML = '<div class="message ai">Project "' + projectName.replace(/</g, "&lt;") + '" is ready. What are we building?</div>';
  goToWorkspace("projects");
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
  projects.forEach((project, index) => {
    const card = document.createElement("div");
    card.className = "project-card";
    const info = document.createElement("div");
    info.className = "project-card-info";
    const title = document.createElement("strong");
    title.textContent = project.name;
    const type = document.createElement("small");
    type.textContent = project.type || "Project";
    info.append(title, type);
    const actions = document.createElement("div");
    actions.className = "project-card-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", () => {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : "session-" + Date.now();
      localStorage.setItem("bendigoSessionId", sessionId);
      if (chat) chat.innerHTML = '<div class="message ai">Opened project: ' + project.name.replace(/</g, "&lt;") + '</div>';
      goToWorkspace("chat");
      input?.focus();
    });
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "Rename";
    rename.addEventListener("click", () => {
      const nextName = prompt("Rename project:", project.name);
      if (!nextName?.trim()) return;
      projects[index].name = nextName.trim();
      projects[index].updatedAt = new Date().toISOString();
      localStorage.setItem("bendigoProjects", JSON.stringify(projects));
      loadProjects();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      if (!confirm("Delete " + project.name + "?")) return;
      projects.splice(index, 1);
      localStorage.setItem("bendigoProjects", JSON.stringify(projects));
      loadProjects();
      updateProjectStat();
    });
    actions.append(open, rename, remove);
    card.append(info, actions);
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
  codePreview.srcdoc = `<!doctype html><html><head><meta charset="UTF-8"><style>html,body{background:#000;color:#fff;margin:0;min-height:100%;} ${css}</style></head><body>${html}<script>${js}<\\/script></body></html>`;
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
    python: $("pythonCode")?.value || "",
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
    const pythonCode = $("pythonCode");
    if (pythonCode && typeof data.python === "string") pythonCode.value = data.python;
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

[htmlCode, cssCode, jsCode, $("pythonCode")].forEach(editor => editor?.addEventListener("input", () => {
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
    if (status) {
      status.textContent = repoData.writeEnabled
        ? "Repository connected • write-ready"
        : "Repository connected • read-only";
    }
    const mode = $("githubConnectionMode");
    if (mode) mode.textContent = repoData.writeEnabled ? "WRITE-READY" : "READ-ONLY";
    const bottomGithub = $("bottomGithubStatus");
    if (bottomGithub) bottomGithub.textContent = repoData.writeEnabled ? "WRITE-READY" : "READ-ONLY";
    ["githubBranchButton","githubCommitButton","githubPrButton"].forEach(id => { const button = $(id); if (button) button.disabled = !repoData.writeEnabled; });
    if (box) {
      box.innerHTML = "";
      (filesData.files || []).forEach(file => {
        const row = document.createElement("div");
        row.className = "github-file";
        const link = document.createElement("a");
        link.href = file.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = (file.type === "dir" ? "📁 " : "📄 ") + file.name;
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
async function githubPost(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || data.details || "GitHub action failed.");
  return data;
}

$("githubBranchButton")?.addEventListener("click", async () => {
  const name = prompt("New branch name:");
  if (!name?.trim()) return;
  try {
    const data = await githubPost("/api/github/branch", {branch:name.trim()});
    if ($("githubBranchName")) $("githubBranchName").textContent = data.branch;
    if ($("githubSyncStatus")) $("githubSyncStatus").textContent = "Branch created • " + data.branch;
    addMessage("GitHub branch created: " + data.branch, "ai");
  } catch (error) {
    addMessage(error.message, "ai");
  }
});

$("githubCommitButton")?.addEventListener("click", async () => {
  const branch = $("githubBranchName")?.textContent?.trim() || "main";
  if (branch === "main") {
    addMessage("Create a working branch before committing Code Lab changes.", "ai");
    return;
  }
  const message = prompt("Commit message:", "Update Bendigo workspace");
  if (!message?.trim()) return;
  try {
    const data = await githubPost("/api/github/commit", {
      branch,
      message: message.trim(),
      files: {
        "bendigo-workspace/index.html": "<!doctype html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>" + (cssCode?.value || "") + "</style></head><body>" + (htmlCode?.value || "") + "<script>" + (jsCode?.value || "").replace(/<\\/script>/gi, "<\\\\/script>") + "<\\/script></body></html>",
        "bendigo-workspace/style.css": cssCode?.value || "",
        "bendigo-workspace/script.js": jsCode?.value || ""
      }
    });
    if ($("githubSyncStatus")) $("githubSyncStatus").textContent = "Committed • " + data.commit.slice(0,7);
    await refreshGithubWorkspace();
    addMessage("Code Lab changes committed to " + branch + ".", "ai");
  } catch (error) {
    addMessage(error.message, "ai");
  }
});

$("githubPrButton")?.addEventListener("click", async () => {
  const branch = $("githubBranchName")?.textContent?.trim() || "";
  if (!branch || branch === "main") {
    addMessage("Create a working branch first, then open a pull request.", "ai");
    return;
  }
  const title = prompt("Pull request title:", "Bendigo AI Code Lab update");
  if (!title?.trim()) return;
  const body = prompt("Pull request description:", "Code Lab changes from Bendigo AI.");
  if (body === null) return;
  try {
    const data = await githubPost("/api/github/pr", {branch, title:title.trim(), body});
    if ($("githubSyncStatus")) $("githubSyncStatus").textContent = "Pull request opened";
    addMessage("Pull request #" + data.number + " opened successfully.", "ai");
    if (data.url) window.open(data.url, "_blank", "noopener");
  } catch (error) {
    addMessage(error.message, "ai");
  }
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

// Bendigo AI Design Studio: local image preview, non-destructive adjustments, and PNG export.
const designImageInput=$("designImageInput");
const designCanvas=$("designCanvas");
const designEmptyState=$("designEmptyState");
const designStatus=$("designStatus");
const designDropZone=$("designDropZone");
const designDownloadButton=$("designDownloadButton");
const designBrightness=$("designBrightness");
const designContrast=$("designContrast");
const designSaturation=$("designSaturation");
const designResetButton=$("designResetButton");
const designRotateLeft=$("designRotateLeft");
const designRotateRight=$("designRotateRight");
const designGrayscale=$("designGrayscale");
let designImage=null;
let designRotation=0;
let designGrayscaleOn=false;
function drawDesignPreview(){
  if(!designCanvas||!designImage)return;
  const maxWidth=900,maxHeight=520,scale=Math.min(maxWidth/designImage.naturalWidth,maxHeight/designImage.naturalHeight,1);
  const rotated=designRotation%180!==0;
  const w=Math.max(1,Math.round(designImage.naturalWidth*scale));
  const h=Math.max(1,Math.round(designImage.naturalHeight*scale));
  designCanvas.width=rotated?h:w;
  designCanvas.height=rotated?w:h;
  const ctx=designCanvas.getContext("2d");
  ctx.save();
  ctx.translate(designCanvas.width/2,designCanvas.height/2);
  ctx.rotate(designRotation*Math.PI/180);
  ctx.filter="brightness("+designBrightness.value+"%) contrast("+designContrast.value+"%) saturate("+designSaturation.value+"%) grayscale("+(designGrayscaleOn?100:0)+"%)";
  ctx.drawImage(designImage,-w/2,-h/2,w,h);
  ctx.restore();
  designCanvas.style.display="block";
  if(designEmptyState)designEmptyState.hidden=true;
  if(designDownloadButton)designDownloadButton.disabled=false;
}
function loadDesignImage(file){
  if(!file||!file.type.startsWith("image/"))return;
  const reader=new FileReader();
  reader.onload=()=>{const image=new Image();image.onload=()=>{designImage=image;drawDesignPreview();if(designStatus)designStatus.textContent=file.name+" • ready to edit"};image.src=reader.result};
  reader.readAsDataURL(file);
}
designImageInput?.addEventListener("change",()=>loadDesignImage(designImageInput.files?.[0]));
[designBrightness,designContrast,designSaturation].forEach(control=>control?.addEventListener("input",drawDesignPreview));
designDropZone?.addEventListener("dragover",e=>{e.preventDefault();designDropZone.classList.add("dragover")});
designDropZone?.addEventListener("dragleave",()=>designDropZone.classList.remove("dragover"));
designDropZone?.addEventListener("drop",e=>{e.preventDefault();designDropZone.classList.remove("dragover");loadDesignImage(e.dataTransfer.files?.[0])});
designResetButton?.addEventListener("click",()=>{designBrightness.value=100;designContrast.value=100;designSaturation.value=100;designRotation=0;designGrayscaleOn=false;if(designGrayscale)designGrayscale.classList.remove("active");if(designImage)drawDesignPreview()});
designRotateLeft?.addEventListener("click",()=>{designRotation=(designRotation+270)%360;if(designImage)drawDesignPreview()});
designRotateRight?.addEventListener("click",()=>{designRotation=(designRotation+90)%360;if(designImage)drawDesignPreview()});
designGrayscale?.addEventListener("click",()=>{designGrayscaleOn=!designGrayscaleOn;designGrayscale.classList.toggle("active",designGrayscaleOn);if(designImage)drawDesignPreview()});
designDownloadButton?.addEventListener("click",()=>{if(!designCanvas||!designImage)return;designCanvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="bendigo-design.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),500)},"image/png")});


// Bendigo AI Design Assistant: local, non-destructive presets with no API key required.
const designAssistantStatus=$("designAssistantStatus");
const designGoals={
  social:{name:"Social post",brightness:106,contrast:108,saturation:112},
  portrait:{name:"Portrait",brightness:104,contrast:96,saturation:94},
  cinematic:{name:"Cinematic",brightness:96,contrast:116,saturation:86},
  clean:{name:"Clean & bright",brightness:112,contrast:104,saturation:105}
};
document.querySelectorAll("[data-design-goal]").forEach(button=>{
  button.addEventListener("click",()=>{
    if(!designImage){
      if(designAssistantStatus)designAssistantStatus.textContent="Upload an image first, then choose a design goal.";
      return;
    }
    const preset=designGoals[button.dataset.designGoal];
    if(!preset)return;
    designBrightness.value=preset.brightness;
    designContrast.value=preset.contrast;
    designSaturation.value=preset.saturation;
    document.querySelectorAll("[data-design-goal]").forEach(item=>item.classList.remove("active"));
    button.classList.add("active");
    drawDesignPreview();
    if(designStatus)designStatus.textContent=preset.name+" preset • ready to refine";
    if(designAssistantStatus)designAssistantStatus.textContent=preset.name+" preset applied. You can fine-tune the sliders.";
  });
});


// Sidebar controls: workspace search and compact mode.
const sidebarSearchButton=$("sidebarSearchButton");
const sidebarSearch=$("sidebarSearch");
const sidebarSearchInput=$("sidebarSearchInput");
const sidebarCollapseButton=$("sidebarCollapseButton");
sidebarSearchButton?.addEventListener("click",()=>{
  if(!sidebarSearch)return;
  sidebarSearch.hidden=!sidebarSearch.hidden;
  if(!sidebarSearch.hidden)sidebarSearchInput?.focus();
});
sidebarSearchInput?.addEventListener("input",()=>{
  const query=sidebarSearchInput.value.trim().toLowerCase();
  document.querySelectorAll(".chatgpt-nav .side-link,.pinned-link,.recent-link").forEach(item=>{
    const label=item.textContent.trim().toLowerCase();
    item.hidden=!!query&&!label.includes(query);
  });
});
sidebarCollapseButton?.addEventListener("click",()=>{
  document.body.classList.toggle("sidebar-collapsed");
  sidebarCollapseButton.setAttribute("aria-label",document.body.classList.contains("sidebar-collapsed")?"Expand sidebar":"Collapse sidebar");
});


// Sidebar More menu.
const sidebarMoreButton=$("sidebarMoreButton");
const sidebarMoreMenu=$("sidebarMoreMenu");
sidebarMoreButton?.addEventListener("click",()=>{
  if(sidebarMoreMenu)sidebarMoreMenu.hidden=!sidebarMoreMenu.hidden;
});
document.querySelectorAll("[data-more-target]").forEach(button=>{
  button.addEventListener("click",()=>{
    const target=button.dataset.moreTarget;
    sidebarMoreMenu?.setAttribute("hidden","");
    if(target)goToWorkspace(target);
    if(target==="github")refreshGithubWorkspace();
  });
});


// Bendigo AI Background Settings: compact colour picker with live tint and brightness control.
(function setupBackgroundSettings(){
  const panel=$("backgroundSettings"), openButton=$("backgroundSettingsButton"), closeButton=$("backgroundSettingsClose");
  const colorSlider=$("backgroundColorSlider"), brightnessSlider=$("backgroundBrightnessSlider");
  const colorValue=$("backgroundColorValue"), brightnessValue=$("backgroundBrightnessValue");
  const preview=$("backgroundPreview"), resetButton=$("backgroundResetButton"), applyButton=$("backgroundApplyButton");
  if(!panel||!openButton||!colorSlider||!brightnessSlider)return;
  const defaults={hue:220,brightness:70};
  let draft={...defaults};
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  function hexFromHue(h){
    const s=0.78,l=0.52,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
    return '#'+[r,g,b].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function rgbFromHex(hex){
    return {
      r:parseInt(hex.slice(1,3),16),
      g:parseInt(hex.slice(3,5),16),
      b:parseInt(hex.slice(5,7),16)
    };
  }
  function tintAlpha(){ return 0.10 + ((draft.brightness/100)*0.28); }
  function applyPreview(){
    const hex=hexFromHue(Number(draft.hue));
    colorSlider.value=draft.hue;
    brightnessSlider.value=draft.brightness;
    if(colorValue)colorValue.textContent=hex;
    if(brightnessValue)brightnessValue.textContent=draft.brightness+'%';
    const rgb=rgbFromHex(hex);
    const alpha=tintAlpha();
    const darken=Math.max(0,0.40-(draft.brightness/100)*0.40);
    if(preview){
      preview.style.background='linear-gradient(rgba('+rgb.r+','+rgb.g+','+rgb.b+','+alpha.toFixed(3)+'),rgba('+rgb.r+','+rgb.g+','+rgb.b+','+alpha.toFixed(3)+')),linear-gradient(rgba(0,0,0,'+darken.toFixed(3)+'),rgba(0,0,0,'+darken.toFixed(3)+')),url("Neon Cosmic Dreams ✨ Magical Galaxy Art.jpg") center/cover';
    }
  }
  function loadSaved(){
    try{
      const saved=JSON.parse(localStorage.getItem('bendigoBackgroundSettings')||'null');
      if(saved)draft={hue:clamp(Number(saved.hue)||defaults.hue,0,360),brightness:clamp(Number(saved.brightness)||defaults.brightness,15,100)};
    }catch{}
    applyPreview();
  }
  function open(){loadSaved();panel.hidden=false;document.body.classList.add('background-settings-open')}
  function close(){panel.hidden=true;document.body.classList.remove('background-settings-open')}
  function save(){
    const hex=hexFromHue(Number(draft.hue));
    const rgb=rgbFromHex(hex);
    const alpha=tintAlpha();
    const darken=Math.max(0,0.40-(draft.brightness/100)*0.40);
    localStorage.setItem('bendigoBackgroundSettings',JSON.stringify(draft));
    document.documentElement.style.setProperty('--bendigo-bg-tint','rgba('+rgb.r+','+rgb.g+','+rgb.b+','+alpha.toFixed(3)+')');
    document.documentElement.style.setProperty('--bendigo-bg-overlay','rgba(0,0,0,'+darken.toFixed(3)+')');
    applyPreview();
  }
  function applySavedToPage(){ loadSaved(); save(); }
  openButton.addEventListener('click',open);
  closeButton?.addEventListener('click',close);
  panel.querySelector('[data-background-close]')?.addEventListener('click',close);
  colorSlider.addEventListener('input',()=>{draft.hue=Number(colorSlider.value);applyPreview()});
  brightnessSlider.addEventListener('input',()=>{draft.brightness=Number(brightnessSlider.value);applyPreview()});
  resetButton?.addEventListener('click',()=>{draft={...defaults};save()});
  applyButton?.addEventListener('click',()=>{save();close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
  applySavedToPage();
})();
