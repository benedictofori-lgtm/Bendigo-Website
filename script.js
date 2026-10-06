const typingIndicator=document.getElementById("typingIndicator"),chatSearch=document.getElementById("chatSearch"),conversationList=document.getElementById("conversationList");const chat=document.getElementById("chat"),input=document.getElementById("userInput"),sendButton=document.getElementById("sendButton"),voiceButton=document.getElementById("voiceButton"),voiceStatus=document.getElementById("voiceStatus"),clearButton=document.getElementById("clearButton"),newChatButton=document.getElementById("newChatButton"),historyButton=document.getElementById("historyButton"),settingsButton=document.getElementById("settingsButton"),aboutButton=document.getElementById("aboutButton"),runCodeButton=document.getElementById("runCodeButton"),htmlCode=document.getElementById("htmlCode"),cssCode=document.getElementById("cssCode"),jsCode=document.getElementById("jsCode"),codePreview=document.getElementById("codePreview");
(function setupExpandedWorkspace(){
  const nav=document.querySelector(".sidebar-workspace-links");
  if(!nav) return;
  const makeNav=(label,target,icon)=>{const b=document.createElement("button");b.type="button";b.className="side-link";b.textContent=icon+" "+label;b.addEventListener("click",()=>{goToWorkspace(target);setActiveNav(b);if(target==="github") refreshGithubWorkspace();});return b;};
  nav.append(
    makeNav("Code","codeLab","⌘"),
    makeNav("Search","chat","⌕"),
    makeNav("Learn","chat","◈")
  );
})();

async function refreshGithubWorkspace(){
  const box=document.getElementById("githubFiles");
  const status=document.getElementById("githubSyncStatus");
  const branchName=document.getElementById("githubBranchName");
  if(status) status.textContent="Syncing…";
  try{
    const [statusResponse,filesResponse]=await Promise.all([
      fetch("/api/github/status"),
      fetch("/api/github/files")
    ]);
    const repoData=await statusResponse.json();
    const filesData=await filesResponse.json();
    if(!statusResponse.ok||!filesResponse.ok) throw new Error(repoData.error||filesData.error||"GitHub sync failed");
    if(branchName) branchName.textContent=repoData.branch||"main";
    if(status) status.textContent="Synced just now";
    if(box){
      box.innerHTML="";
      (filesData.files||[]).filter(file=>file.type==="file").forEach(file=>{
        const row=document.createElement("div");
        row.className="github-file";
        const link=document.createElement("a");
        link.href=file.url; link.target="_blank"; link.rel="noopener";
        link.textContent=file.name;
        row.appendChild(link);
        box.appendChild(row);
      });
      if(!box.children.length) box.innerHTML='<div class="github-file">No repository files found.</div>';
    }
  }catch(error){
    if(status) status.textContent="Sync failed";
    if(box) box.innerHTML='<div class="github-file">GitHub sync could not be completed. Check the server connection.</div>';
    console.error(error);
  }
}

document.getElementById("githubSyncButton")?.addEventListener("click",refreshGithubWorkspace);
document.getElementById("githubBranchButton")?.addEventListener("click",()=>{
  const name=prompt("New branch name:");
  if(name?.trim()) addMessage("GitHub branch requested: "+name.trim()+". Branch creation will be connected to the GitHub write API next.","ai");
});
document.getElementById("githubCommitButton")?.addEventListener("click",()=>{
  addMessage("GitHub commit workspace is ready. Next we can connect file changes to commits without exposing a GitHub token in the browser.","ai");
});
document.getElementById("githubPrButton")?.addEventListener("click",()=>{
  addMessage("Pull request workspace is ready. Next we can connect branch changes to pull requests and reviews.","ai");
});

refreshGithubWorkspace();
