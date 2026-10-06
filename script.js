const typingIndicator=document.getElementById("typingIndicator"),chatSearch=document.getElementById("chatSearch"),conversationList=document.getElementById("conversationList");const chat=document.getElementById("chat"),input=document.getElementById("userInput"),sendButton=document.getElementById("sendButton"),voiceButton=document.getElementById("voiceButton"),voiceStatus=document.getElementById("voiceStatus"),clearButton=document.getElementById("clearButton"),newChatButton=document.getElementById("newChatButton"),historyButton=document.getElementById("historyButton"),settingsButton=document.getElementById("settingsButton"),aboutButton=document.getElementById("aboutButton"),runCodeButton=document.getElementById("runCodeButton"),htmlCode=document.getElementById("htmlCode"),cssCode=document.getElementById("cssCode"),jsCode=document.getElementById("jsCode"),codePreview=document.getElementById("codePreview");
const gameArea=document.getElementById("gameArea"),playerCar=document.getElementById("playerCar"),enemyCar=document.getElementById("enemyCar"),gameScore=document.getElementById("gameScore"),gameMessage=document.getElementById("gameMessage"),startGameButton=document.getElementById("startGameButton"),leftButton=document.getElementById("leftButton"),rightButton=document.getElementById("rightButton");
const playerFighter=document.getElementById("playerFighter"),cpuFighter=document.getElementById("cpuFighter"),playerHealth=document.getElementById("playerHealth"),cpuHealth=document.getElementById("cpuHealth"),fightArena=document.getElementById("fightArena"),fightMessage=document.getElementById("fightMessage"),startFightButton=document.getElementById("startFightButton"),attackButton=document.getElementById("attackButton"),defendButton=document.getElementById("defendButton");
const studioButton=document.getElementById("studioButton"),designStudio=document.getElementById("designStudio"),canvas=document.getElementById("designCanvas"),ctx=canvas.getContext("2d"),drawColor=document.getElementById("drawColor"),brushSize=document.getElementById("brushSize"),brushSizeValue=document.getElementById("brushSizeValue"),studioHint=document.getElementById("studioHint"),imageUpload=document.getElementById("imageUpload");const brightnessControl=document.getElementById("brightnessControl"),contrastControl=document.getElementById("contrastControl"),filterControl=document.getElementById("filterControl");let studioTool="brush",drawing=false,startPoint=null,lastPoint=null,undoStack=[],redoStack=[];
ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
function saveCanvasState(){if(undoStack.length>25)undoStack.shift();undoStack.push(canvas.toDataURL());redoStack=[]}
function restoreState(data){const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);};img.src=data}
function setTool(tool){studioTool=tool;document.querySelectorAll(".studio-toolbar button").forEach(b=>b.classList.remove("active"));const el=document.getElementById(tool+"Tool");if(el)el.classList.add("active");studioHint.textContent=tool==="text"?"Click the canvas, then type your text.":"Choose a color and draw on the canvas.";canvas.style.cursor=tool==="text"?"text":"crosshair"}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function drawLine(a,b,color=drawColor.value){ctx.strokeStyle=color;ctx.lineWidth=Number(brushSize.value);ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
function pointerDown(e){const p=point(e);if(studioTool==="text"){const value=prompt("Enter your text:");if(value){saveCanvasState();ctx.fillStyle=drawColor.value;ctx.font=Math.max(12,Number(brushSize.value)*5)+"px Arial";ctx.fillText(value,p.x,p.y)}return}drawing=true;startPoint=p;lastPoint=p;canvas.setPointerCapture?.(e.pointerId);if(studioTool==="brush"||studioTool==="eraser"){saveCanvasState();drawLine(p,p,studioTool==="eraser"?"#ffffff":drawColor.value)}}
function pointerMove(e){if(!drawing)return;const p=point(e);if(studioTool==="brush"||studioTool==="eraser"){drawLine(lastPoint,p,studioTool==="eraser"?"#ffffff":drawColor.value);lastPoint=p}}
function pointerUp(e){if(!drawing)return;drawing=false;const p=point(e);if(studioTool==="line"||studioTool==="rect"||studioTool==="circle"){saveCanvasState();ctx.strokeStyle=drawColor.value;ctx.lineWidth=Number(brushSize.value);ctx.lineCap="round";const w=p.x-startPoint.x,h=p.y-startPoint.y;if(studioTool==="line"){drawLine(startPoint,p)}else if(studioTool==="rect"){ctx.strokeRect(startPoint.x,startPoint.y,w,h)}else{ctx.beginPath();ctx.ellipse(startPoint.x+w/2,startPoint.y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);ctx.stroke()}}}
function undo(){if(!undoStack.length)return;redoStack.push(canvas.toDataURL());restoreState(undoStack.pop())}
function redo(){if(!redoStack.length)return;undoStack.push(canvas.toDataURL());restoreState(redoStack.pop())}
function clearCanvas(){saveCanvasState();ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height)}
function setCanvasBackground(color){saveCanvasState();ctx.save();ctx.globalCompositeOperation="destination-over";ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore()}
function addSticker(){const stickers=["⭐","❤️","🔥","😊","🎮","🎵","🚀","⚽","🎨","🇬🇭"];const sticker=prompt("Choose a sticker: "+stickers.join(" "));if(!sticker)return;saveCanvasState();ctx.font="64px Arial";ctx.fillText(sticker,canvas.width/2-32,canvas.height/2+22)}

function applyPhotoFilter(){canvas.style.filter="brightness("+brightnessControl.value+"%) contrast("+contrastControl.value+"%) "+filterControl.value}
function resetPhoto(){brightnessControl.value=100;contrastControl.value=100;filterControl.value="none";canvas.style.filter="none"}
function rotateCanvas(){saveCanvasState();const temp=document.createElement("canvas");temp.width=canvas.height;temp.height=canvas.width;const t=temp.getContext("2d");t.translate(temp.width/2,temp.height/2);t.rotate(Math.PI/2);t.drawImage(canvas,-canvas.width/2,-canvas.height/2);canvas.width=temp.width;canvas.height=temp.height;ctx.drawImage(temp,0,0);canvas.style.aspectRatio=canvas.width+"/"+canvas.height}
function addImage(file){const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{saveCanvasState();const scale=Math.min(canvas.width/img.width,canvas.height/img.height,1);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h)};img.src=e.target.result};reader.readAsDataURL(file)}
["brush","eraser","line","rect","circle","text"].forEach(t=>document.getElementById(t+"Tool").addEventListener("click",()=>setTool(t)));document.getElementById("stickerTool").addEventListener("click",addSticker);document.getElementById("backgroundCanvas").addEventListener("click",()=>setCanvasBackground(drawColor.value));document.querySelectorAll(".studio-presets button").forEach(b=>b.addEventListener("click",()=>setCanvasBackground(b.dataset.bg)));canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointermove",pointerMove);canvas.addEventListener("pointerup",pointerUp);canvas.addEventListener("pointercancel",pointerUp);brushSize.addEventListener("input",()=>brushSizeValue.textContent=brushSize.value);document.getElementById("undoDesign").addEventListener("click",undo);document.getElementById("redoDesign").addEventListener("click",redo);document.getElementById("clearCanvas").addEventListener("click",clearCanvas);document.getElementById("downloadCanvas").addEventListener("click",()=>{const a=document.createElement("a");a.download="bendigo-design.png";a.href=canvas.toDataURL("image/png");a.click()});imageUpload.addEventListener("change",e=>{if(e.target.files[0])addImage(e.target.files[0]);e.target.value=""});brightnessControl.addEventListener("input",applyPhotoFilter);contrastControl.addEventListener("input",applyPhotoFilter);filterControl.addEventListener("change",applyPhotoFilter);document.getElementById("rotateCanvas").addEventListener("click",rotateCanvas);document.getElementById("resetCanvas").addEventListener("click",resetPhoto);setTool("brush");
const gamesButton=document.getElementById("gamesButton"),gameCards=[...document.querySelectorAll(".game-card")];
function openGame(id){const target=document.getElementById(id);if(!target)return;target.scrollIntoView({behavior:"smooth",block:"start"});gameCards.forEach(card=>card.classList.toggle("active",card.dataset.game===id));}
gameCards.forEach(card=>card.addEventListener("click",()=>openGame(card.dataset.game)));
const history=[];let sessionId=localStorage.getItem("bendigoSessionId")||crypto.randomUUID();localStorage.setItem("bendigoSessionId",sessionId);let gameRunning=false,gameAnimation,enemyX=0,enemyY=-80,playerX=0,score=0,lastTime=0;
let fightRunning=false,playerHP=100,cpuHP=100,playerFightX=0,defending=false,cpuTimer;

function addMessage(text,type){const message=document.createElement("div");message.className="message "+type;message.textContent=text;chat.appendChild(message);chat.scrollTop=chat.scrollHeight}
function speak(text){if(!("speechSynthesis"in window))return;window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang="en-GH";speech.rate=1;speech.pitch=1;window.speechSynthesis.speak(speech)}
async function sendMessage(){const text=input.value.trim();if(!text)return;addMessage(text,"user");history.push({role:"user",content:text});input.value="";sendButton.disabled=true;sendButton.textContent="Thinking...";if(typingIndicator)typingIndicator.style.display="flex";try{const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,history:history.slice(-10),sessionId})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Something went wrong.");addMessage(data.reply,"ai");history.push({role:"assistant",content:data.reply});speak(data.reply)}catch(error){console.error(error);addMessage("Sorry, Bendigo AI could not respond right now. Please try again.","ai")}finally{sendButton.disabled=false;sendButton.textContent="Send";if(typingIndicator)typingIndicator.style.display="none";input.focus()}}
async function startNewChat(){sessionId=crypto.randomUUID();localStorage.setItem("bendigoSessionId",sessionId);chat.innerHTML="";history.length=0;window.speechSynthesis.cancel();addMessage("New chat started! 👋 I'm Bendigo AI. How can I help?","ai");input.focus();await loadConversations()}
function runCode(){const html=htmlCode.value,css=cssCode.value.replace(/<\/style>/gi,""),js=jsCode.value.replace(/<\/script>/gi,"");codePreview.srcdoc=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${html}<script>try{${js}}catch(error){document.body.insertAdjacentHTML("beforeend","<pre style='color:red;white-space:pre-wrap'>"+error.message+"</pre>")}<\/script></body></html>`}

function resetGame(){cancelAnimationFrame(gameAnimation);gameRunning=true;score=0;lastTime=0;playerX=(gameArea.clientWidth-52)/2;enemyX=Math.random()*Math.max(1,gameArea.clientWidth-52);enemyY=-80;gameScore.textContent="0";gameMessage.textContent="";playerCar.style.left=playerX+"px";enemyCar.style.left=enemyX+"px";enemyCar.style.top=enemyY+"px";startGameButton.textContent="🔄 Restart Race";gameArea.focus();gameAnimation=requestAnimationFrame(gameLoop)}
function movePlayer(direction){if(!gameRunning)return;playerX+=direction*28;playerX=Math.max(0,Math.min(gameArea.clientWidth-52,playerX));playerCar.style.left=playerX+"px"}
function gameLoop(timestamp){if(!gameRunning)return;if(!lastTime)lastTime=timestamp;const delta=Math.min(40,timestamp-lastTime);lastTime=timestamp;enemyY+=delta*.22;if(enemyY>gameArea.clientHeight){enemyY=-80;enemyX=Math.random()*Math.max(1,gameArea.clientWidth-52);score++;gameScore.textContent=String(score)}enemyCar.style.left=enemyX+"px";enemyCar.style.top=enemyY+"px";const hit=playerX<enemyX+52&&playerX+52>enemyX&&gameArea.clientHeight-83<enemyY+65&&gameArea.clientHeight-18>enemyY;if(hit){gameRunning=false;cancelAnimationFrame(gameAnimation);gameMessage.textContent="💥 Game Over! Score: "+score;startGameButton.textContent="🏁 Start Race";return}gameAnimation=requestAnimationFrame(gameLoop)}

function updateFightBars(){playerHealth.style.width=playerHP+"%";cpuHealth.style.width=cpuHP+"%"}
function resetFight(){clearInterval(cpuTimer);fightRunning=true;playerHP=100;cpuHP=100;defending=false;playerFightX=12;playerFighter.style.left=playerFightX+"%";cpuFighter.style.left="76%";fightMessage.textContent="";updateFightBars();startFightButton.textContent="🔄 Restart Fight";fightArena.focus();cpuTimer=setInterval(cpuAttack,1300)}
function moveFighter(direction){if(!fightRunning)return;playerFightX+=direction*5;playerFightX=Math.max(2,Math.min(68,playerFightX));playerFighter.style.left=playerFightX+"%"}
function attack(){if(!fightRunning)return;const playerPixels=playerFightX/100*fightArena.clientWidth;const cpuPixels=.76*fightArena.clientWidth;if(Math.abs(playerPixels-cpuPixels)<115){cpuHP=Math.max(0,cpuHP-12);cpuFighter.style.transform="translateX(8px)";setTimeout(()=>cpuFighter.style.transform="",120);updateFightBars();checkFightEnd()}else{fightMessage.textContent="Move closer to attack!";setTimeout(()=>{if(fightRunning)fightMessage.textContent=""},500)}}
function defend(){if(!fightRunning)return;defending=true;fightMessage.textContent="🛡️ Defending";setTimeout(()=>{defending=false;if(fightRunning)fightMessage.textContent=""},500)}
function cpuAttack(){if(!fightRunning)return;const playerPixels=playerFightX/100*fightArena.clientWidth,cpuPixels=.76*fightArena.clientWidth;if(Math.abs(playerPixels-cpuPixels)<125){if(!defending){playerHP=Math.max(0,playerHP-8);playerFighter.style.transform="translateX(-8px)";setTimeout(()=>playerFighter.style.transform="",120);updateFightBars();checkFightEnd()}}}
function checkFightEnd(){if(cpuHP<=0){fightRunning=false;clearInterval(cpuTimer);fightMessage.textContent="🏆 You Win!";startFightButton.textContent="🥊 Start Fight"}else if(playerHP<=0){fightRunning=false;clearInterval(cpuTimer);fightMessage.textContent="🤖 CPU Wins!";startFightButton.textContent="🥊 Start Fight"}}
startGameButton.addEventListener("click",resetGame);leftButton.addEventListener("click",()=>movePlayer(-1));rightButton.addEventListener("click",()=>movePlayer(1));
startFightButton.addEventListener("click",resetFight);attackButton.addEventListener("click",attack);defendButton.addEventListener("click",defend);
document.addEventListener("keydown",event=>{if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a"){if(document.activeElement!==input)movePlayer(-1),moveFighter(-1)}if(event.key==="ArrowRight"||event.key.toLowerCase()==="d"){if(document.activeElement!==input)movePlayer(1),moveFighter(1)}if(event.code==="Space"&&document.activeElement===fightArena){event.preventDefault();attack()}if(event.key.toLowerCase()==="s"&&document.activeElement===fightArena)defend()});
document.querySelectorAll(".quick-prompts [data-prompt]").forEach(button=>button.addEventListener("click",()=>{input.value=button.dataset.prompt||"";input.focus();}));
sendButton.addEventListener("click",sendMessage);input.addEventListener("keydown",event=>{if(event.key==="Enter")sendMessage()});runCodeButton.addEventListener("click",runCode);clearButton.addEventListener("click",startNewChat);
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(SpeechRecognition){const recognition=new SpeechRecognition();recognition.lang="en-GH";recognition.interimResults=false;recognition.continuous=false;voiceButton.addEventListener("click",()=>{recognition.start();voiceButton.disabled=true;voiceStatus.textContent="Listening... 🎤"});recognition.addEventListener("result",event=>{input.value=event.results[0][0].transcript;voiceStatus.textContent="Voice captured. Click Send."});recognition.addEventListener("end",()=>{voiceButton.disabled=false;if(!input.value.trim())voiceStatus.textContent=""});recognition.addEventListener("error",()=>{voiceButton.disabled=false;voiceStatus.textContent="Voice input was not available. Please try again."})}else{voiceButton.disabled=true;voiceStatus.textContent="Voice input is not supported by this browser."}

const adventureArea=document.getElementById("adventureArea"),adventurePlayer=document.getElementById("adventurePlayer"),adventureScore=document.getElementById("adventureScore"),adventureMessage=document.getElementById("adventureMessage"),startAdventureButton=document.getElementById("startAdventureButton"),jumpButton=document.getElementById("jumpButton");const adventureStars=[...document.querySelectorAll(".adventure-star")];let adventureRunning=false,adventureX=8,adventureY=0,adventureVelocity=0,adventureStarsGot=0,adventureAnimation,adventureJumping=false;
function resetAdventure(){adventureRunning=true;adventureX=8;adventureY=0;adventureVelocity=0;adventureStarsGot=0;adventureJumping=false;adventureScore.textContent="0";adventureMessage.textContent="";adventureStars.forEach(s=>s.style.visibility="visible");adventurePlayer.style.left=adventureX+"%";adventurePlayer.style.bottom="25%";startAdventureButton.textContent="🔄 Restart Adventure";adventureArea.focus();cancelAnimationFrame(adventureAnimation);adventureAnimation=requestAnimationFrame(adventureLoop)}
function moveAdventure(d){if(!adventureRunning)return;adventureX+=d*3;adventureX=Math.max(2,Math.min(88,adventureX));adventurePlayer.style.left=adventureX+"%"}
function jumpAdventure(){if(!adventureRunning||adventureJumping)return;adventureJumping=true;adventureVelocity=12}
function adventureLoop(){if(!adventureRunning)return;adventureVelocity-=.65;adventureY+=adventureVelocity;if(adventureY<=0){adventureY=0;adventureVelocity=0;adventureJumping=false}adventurePlayer.style.transform="translateY("+(-adventureY)+"px)";const px=adventureX/100*adventureArea.clientWidth;adventureStars.forEach((s,i)=>{if(s.style.visibility==="hidden")return;const sx=s.offsetLeft;if(Math.abs(px-sx)<38&&Math.abs((adventureY+70)-(adventureArea.clientHeight-s.offsetTop))<70){s.style.visibility="hidden";adventureStarsGot++;adventureScore.textContent=String(adventureStarsGot)}});if(adventureX>82&&adventureStarsGot===adventureStars.length){adventureRunning=false;adventureMessage.textContent="🏆 Adventure Complete!";return}if(adventureX>82&&adventureStarsGot<adventureStars.length){adventureMessage.textContent="Collect all ⭐ first!";setTimeout(()=>{if(adventureRunning)adventureMessage.textContent=""},700)}adventureAnimation=requestAnimationFrame(adventureLoop)}
startAdventureButton.addEventListener("click",resetAdventure);jumpButton.addEventListener("click",jumpAdventure);
runCode();updateFightBars();loadSavedChat();loadConversations();

if(chatSearch){chatSearch.addEventListener("input",()=>{const q=chatSearch.value.trim().toLowerCase();document.querySelectorAll("#chat .message").forEach(m=>{m.style.display=!q||m.textContent.toLowerCase().includes(q)?"":"none"});renderConversations()})}

async function loadSavedChat(){try{const r=await fetch("/api/chat/history?sessionId="+encodeURIComponent(sessionId));if(!r.ok)return;const data=await r.json();if(data.messages?.length){chat.innerHTML="";history.length=0;data.messages.forEach(m=>{history.push({role:m.role,content:m.content});addMessage(m.content,m.role==="assistant"?"ai":"user")})}}catch(e){console.error("Could not load chat history",e)}}
let savedConversations=[];
async function loadConversations(){if(!conversationList)return;try{const r=await fetch("/api/chat/conversations");const data=await r.json();savedConversations=data.conversations||[];renderConversations()}catch(e){console.error("Could not load conversations",e)}}
function renderConversations(){if(!conversationList)return;const query=(chatSearch?.value||"").trim().toLowerCase();conversationList.innerHTML="";if(!query){conversationList.style.display="none";return}conversationList.style.display="block";const matches=savedConversations.filter(c=>(c.title||"").toLowerCase().includes(query));if(!matches.length){conversationList.innerHTML='<div class="conversation-empty">No matching chats</div>';return}matches.forEach(c=>{const row=document.createElement("div");row.className="conversation-row"+(c.session_id===sessionId?" active":"");const open=document.createElement("button");open.type="button";open.className="conversation-item";open.textContent=c.title;open.title=c.title;open.addEventListener("click",()=>switchConversation(c.session_id));const del=document.createElement("button");del.type="button";del.className="conversation-delete";del.textContent="×";del.title="Delete chat";del.addEventListener("click",async e=>{e.stopPropagation();await deleteConversation(c.session_id)});row.append(open,del);conversationList.appendChild(row)})}
async function switchConversation(id){sessionId=id;localStorage.setItem("bendigoSessionId",sessionId);chat.innerHTML="";history.length=0;await loadSavedChat();await loadConversations();input.focus()}
async function deleteConversation(id){try{const r=await fetch("/api/chat/conversations/"+encodeURIComponent(id),{method:"DELETE"});if(!r.ok)throw new Error("Delete failed");if(id===sessionId){sessionId=crypto.randomUUID();localStorage.setItem("bendigoSessionId",sessionId);chat.innerHTML="";history.length=0;addMessage("New chat started! 👋 I'm Bendigo AI. How can I help?","ai")}await loadConversations()}catch(e){console.error("Could not delete conversation",e)}}

/* Workspace dashboard navigation */

/* Bendigo AI workspace navigation */
const dashboardButton=document.getElementById("dashboardButton");
const startBuildingButton=document.getElementById("startBuildingButton");
const openWorkspaceButton=document.getElementById("openWorkspaceButton");
const mainChat=document.querySelector(".main-chat");
function goToWorkspace(target){
  const el=document.getElementById(target);
  if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
}
function setActiveNav(button){
  document.querySelectorAll(".side-link").forEach(b=>b.classList.remove("active"));
  if(button) button.classList.add("active");
}
if(dashboardButton) dashboardButton.addEventListener("click",()=>{goToWorkspace("dashboard");setActiveNav(dashboardButton)});
if(startBuildingButton) startBuildingButton.addEventListener("click",()=>goToWorkspace("chat"));
if(openWorkspaceButton) openWorkspaceButton.addEventListener("click",()=>goToWorkspace("codeLab"));
if(gamesButton) gamesButton.addEventListener("click",()=>{openGame("gameCenter");setActiveNav(gamesButton)});
if(studioButton) studioButton.addEventListener("click",()=>{designStudio.scrollIntoView({behavior:"smooth",block:"start"});setTool("brush");setActiveNav(studioButton)});
if(historyButton) historyButton.addEventListener("click",async()=>{await loadConversations();conversationList?.scrollIntoView({behavior:"smooth",block:"nearest"});setActiveNav(historyButton)});
if(settingsButton) settingsButton.addEventListener("click",()=>{addMessage("Settings: 🎤 Voice input and 🔊 spoken replies are enabled. You can use Bendigo AI without an API key when the local fallback is available.","ai");goToWorkspace("chat");setActiveNav(settingsButton)});
if(aboutButton) aboutButton.addEventListener("click",()=>{addMessage("Bendigo AI is your workspace for AI chat, coding, design, and games. Music Studio has been removed.","ai");goToWorkspace("chat");setActiveNav(aboutButton)});
document.querySelectorAll("[data-builder]").forEach(btn=>btn.addEventListener("click",()=>{const type=btn.dataset.builder;const prompts={website:"Help me build a modern website step by step.",game:"Help me build a playable game step by step.",python:"Help me start a Python project step by step.",design:"Help me create a visual design project step by step."};input.value=prompts[type]||"Help me build a project.";goToWorkspace("chat");input.focus();sendMessage() }));
const sidebarWorkspaceLinks=document.querySelector(".sidebar-workspace-links");
const builderButton=document.createElement("button");
builderButton.type="button";builderButton.className="side-link";builderButton.textContent="✦ Builder";
builderButton.addEventListener("click",()=>{goToWorkspace("builder");setActiveNav(builderButton)});
const workspaceButton=document.createElement("button");
workspaceButton.type="button";workspaceButton.className="side-link";workspaceButton.textContent="▣ Workspace";
workspaceButton.addEventListener("click",()=>{goToWorkspace("chat");setActiveNav(workspaceButton)});
const projectsButton=document.createElement("button");
projectsButton.type="button";projectsButton.className="side-link";projectsButton.textContent="▦ Projects";
projectsButton.addEventListener("click",()=>{goToWorkspace("projects");setActiveNav(projectsButton)});
const githubButton=document.createElement("button");
githubButton.type="button";githubButton.className="side-link";githubButton.textContent="◉ GitHub";
githubButton.addEventListener("click",()=>{goToWorkspace("github");loadGithubFiles();setActiveNav(githubButton)});
const settingsButtonRef=document.getElementById("settingsButton");
if(sidebarWorkspaceLinks){
  sidebarWorkspaceLinks.append(workspaceButton,builderButton,projectsButton,githubButton);
}
if(settingsButtonRef) settingsButtonRef.style.display="none";
if(document.getElementById("gamesButton")) document.getElementById("gamesButton").style.display="none";
if(document.getElementById("studioButton")) document.getElementById("studioButton").style.display="none";
if(document.getElementById("historyButton")) document.getElementById("historyButton").style.display="none";
if(document.getElementById("aboutButton")) document.getElementById("aboutButton").style.display="none";
const sidebarEditButton=document.getElementById("sidebarEditButton");
if(sidebarEditButton) sidebarEditButton.addEventListener("click",()=>goToWorkspace("projects"));
if(newChatButton) newChatButton.textContent="＋ New project";
if(newChatButton) newChatButton.addEventListener("click",()=>newProjectButton?.click());
setActiveNav(dashboardButton);

async function loadGithubFiles(){const box=document.getElementById("githubFiles");if(!box)return;try{const r=await fetch("https://api.github.com/repos/benedictofori-lgtm/Bendigo-website/contents");if(!r.ok)throw new Error("GitHub request failed");const files=await r.json();box.innerHTML="";files.filter(x=>x.type==="file").forEach(x=>{const el=document.createElement("div");el.className="github-file";el.textContent=x.name;box.appendChild(el)})}catch(e){box.innerHTML='<div class="github-file">Repository files could not be loaded right now.</div>';console.error(e)}}
loadGithubFiles();
/* Projects */
const projectGrid=document.getElementById("projectGrid");
const newProjectButton=document.getElementById("newProjectButton");
const projectStoreKey="bendigoProjects";
function getProjects(){
  try{return JSON.parse(localStorage.getItem(projectStoreKey)||"[]")}catch{return[]}
}
function saveProjects(items){localStorage.setItem(projectStoreKey,JSON.stringify(items))}
function renderProjects(){
  if(!projectGrid)return;
  let projects=getProjects();
  if(!projects.length)projects=[{id:"bendigo-ai",name:"Bendigo AI",description:"AI assistant, games, design and coding workspace.",files:"HTML · CSS · JS",icon:"AI"}];
  projectGrid.innerHTML="";
  projects.forEach(p=>{
    const card=document.createElement("article");card.className="project-card";
    card.innerHTML='<div><div class="project-icon"></div><h3></h3><p></p></div><button type="button">Open project</button>';
    card.querySelector(".project-icon").textContent=p.icon||"AI";
    card.querySelector("h3").textContent=p.name;
    card.querySelector("p").textContent=p.description+(p.files?" · "+p.files:"");
    card.querySelector("button").addEventListener("click",()=>{goToWorkspace("chat");addMessage("Opening project: "+p.name+". What would you like to build next?","ai")});
    projectGrid.appendChild(card);
  });
}
if(newProjectButton)newProjectButton.addEventListener("click",()=>{
  const name=prompt("Project name:");
  if(!name?.trim())return;
  const projects=getProjects();
  projects.push({id:crypto.randomUUID(),name:name.trim(),description:"New Bendigo AI project",files:"Ready to build",icon:"✦"});
  saveProjects(projects);renderProjects();
});
const projectsNav=document.querySelector(".side-section");
renderProjects();


/* Bendigo AI expanded workspace navigation + GitHub sync */
(function setupExpandedWorkspace(){
  const nav=document.querySelector(".sidebar-workspace-links");
  if(!nav) return;
  const makeNav=(label,target,icon)=>{const b=document.createElement("button");b.type="button";b.className="side-link";b.textContent=icon+" "+label;b.addEventListener("click",()=>{goToWorkspace(target);setActiveNav(b);if(target==="github") refreshGithubWorkspace();});return b;};
  nav.append(
    makeNav("Code","codeLab","⌘"),
    makeNav("Image Studio","designStudio","▧"),
    makeNav("Design","designStudio","✦"),
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
