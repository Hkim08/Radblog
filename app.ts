/**
 * Cloudflare Workers app entry point.
 * Session persistence is handled by Flue's Durable Object-backed runtime.
 */
import { registerProvider } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

const app = new Hono();

// ── Shared HTML fragments ──
const style = `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:#f5f5f5;color:#333}
nav{background:#1a1a2e;padding:1rem 2rem;display:flex;gap:1.5rem;align-items:center}
nav a{color:#fff;text-decoration:none;font-size:.95rem;padding:.25rem .5rem;border-radius:4px}
nav a:hover{background:rgba(255,255,255,.1)}
nav .brand{font-weight:700;font-size:1.1rem;margin-right:auto}
.container{max-width:1000px;margin:2rem auto;padding:0 1rem}
.card{background:#fff;border-radius:8px;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:1.5rem}
h1{font-size:1.5rem;margin-bottom:1rem}
h2{font-size:1.2rem;margin-bottom:.75rem;color:#555}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2rem}
.stat-card{background:#1a1a2e;color:#fff;padding:1.5rem;border-radius:8px;text-align:center}
.stat-card .num{font-size:2rem;font-weight:700}
.stat-card .label{font-size:.85rem;opacity:.8;margin-top:.25rem}
.agents{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}
.agents span{background:#e8e8f0;padding:.35rem .75rem;border-radius:4px;font-size:.9rem}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:.6rem .75rem;border-bottom:1px solid #eee}
th{font-weight:600;color:#555;font-size:.85rem;text-transform:uppercase}
.btn{display:inline-block;padding:.5rem 1rem;border-radius:6px;text-decoration:none;font-size:.9rem;cursor:pointer;border:none}
.btn-primary{background:#1a1a2e;color:#fff}
.btn-primary:hover{background:#2d2d5e}
.btn-outline{background:transparent;color:#1a1a2e;border:1px solid #1a1a2e}
.btn-outline:hover{background:#1a1a2e;color:#fff}
.landing-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:2rem;margin-top:2rem}
.landing-card{background:#fff;border-radius:12px;padding:2.5rem;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.landing-card h2{font-size:1.3rem;margin-bottom:.5rem;color:#333}
.landing-card p{color:#666;margin-bottom:1.5rem}
.landing-card .btn{font-size:1rem;padding:.75rem 2rem}
.landing-hero{text-align:center;padding:4rem 0 2rem}
.landing-hero h1{font-size:2.5rem;margin-bottom:.5rem}
.landing-hero p{color:#666;font-size:1.1rem}
.workflow-list{list-style:none;padding:0}
.workflow-list li{padding:.5rem 0;border-bottom:1px solid #eee}
.workflow-list li:last-child{border-bottom:none}
#chat-messages{flex:1;overflow-y:auto;padding:1rem;min-height:400px;max-height:60vh}
.chat-msg{margin-bottom:.75rem}
.chat-msg .sender{font-weight:600;font-size:.85rem;color:#555}
.chat-msg .text{margin-top:.15rem}
.chat-input-area{display:flex;gap:.5rem;padding:1rem 0}
.chat-input-area input{flex:1;padding:.6rem .75rem;border:1px solid #ddd;border-radius:6px;font-size:.95rem}
.chat-input-area button{padding:.6rem 1.5rem}
.chat-hint{font-size:.8rem;color:#999;margin-top:.5rem}
#chat-layout{display:flex;height:75vh;border:1px solid #ddd;border-radius:8px;overflow:hidden}
#chat-sidebar{width:220px;background:#fafafa;border-right:1px solid #ddd;display:flex;flex-direction:column;font-size:.85rem}
#chat-sidebar-header{padding:.75rem;border-bottom:1px solid #ddd;font-weight:600;display:flex;justify-content:space-between;align-items:center}
#chat-sidebar-list{flex:1;overflow-y:auto;padding:.25rem 0}
.chat-session-item{padding:.5rem .75rem;cursor:pointer;border-left:3px solid transparent;display:flex;justify-content:space-between;align-items:center}
.chat-session-item:hover{background:#eee}
.chat-session-item.active{background:#e0e0f0;border-left-color:#1a1a2e;font-weight:600}
.chat-session-item .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.chat-session-item .del{color:#999;cursor:pointer;font-size:.8rem;padding:0 .25rem;display:none}
.chat-session-item:hover .del{display:inline}
.chat-session-item .del:hover{color:#f44336}
#chat-main{flex:1;display:flex;flex-direction:column}
</style>`;

const nav = `<nav>
<a href="/" class="brand">Blog Engine</a>
<a href="/admin">Dashboard</a>
<a href="/chat">Chat</a>
</nav>`;

const head = (title: string) =>
	`<!DOCTYPE html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Blog Engine - ${title}</title>${style}</head><body>${nav}<div class="container">`;

const foot = '</div></body></html>';

// ── Landing page ──
app.get('/', (c) =>
	c.html(
		`${head('Home')}<div class="landing-hero"><h1>Blog Engine</h1><p>AI-powered blog creation and optimization</p></div><div class="landing-cards"><div class="landing-card"><h2>Open Chat</h2><p>Interact with the blog orchestrator AI assistant</p><a href="/chat" class="btn btn-primary">Open Chat</a></div><div class="landing-card"><h2>Dashboard</h2><p>Manage workflows, agents, and blog posts</p><a href="/admin" class="btn btn-outline">Dashboard</a></div></div>${foot}`,
	),
);

// ── Dashboard ──
app.get('/admin', (c) => {
	const agents = ['orchestrator', 'researcher', 'writer', 'seo', 'reviewer', 'translator'];
	const workflows = [
		'blog-write', 'blog-rewrite', 'blog-analyze', 'blog-outline', 'blog-brief',
		'blog-calendar', 'blog-strategy', 'blog-cluster', 'blog-audit', 'blog-schema',
		'blog-seo-check', 'blog-geo', 'blog-cannibalization', 'blog-repurpose',
		'blog-translate', 'blog-localize', 'blog-locale-audit', 'blog-factcheck',
		'blog-multilingual',
	];
	return c.html(
		`${head('Dashboard')}<div class="stats"><div class="stat-card"><div class="num">6</div><div class="label">Agents</div></div><div class="stat-card"><div class="num">19</div><div class="label">Workflows</div></div></div><div class="card"><h2>Quick Actions</h2><p><a href="/chat" class="btn btn-primary">Write a Post</a></p></div><div class="card"><h2>Agents</h2><div class="agents">${agents.map((a) => `<span>${a}</span>`).join('')}</div></div><div class="card"><h2>Workflows</h2><ul class="workflow-list">${workflows.map((w) => `<li><code>${w}</code></li>`).join('')}</ul></div>${foot}`,
	);
});

// ── Chat page ──
app.get('/chat', (c) => {
	const html = `${head('Chat')}<div id="chat-layout"><div id="chat-sidebar"><div id="chat-sidebar-header"><span>Sessions</span><button class="btn btn-primary" style="padding:.25rem .5rem;font-size:.8rem" onclick="newSession()">+</button></div><div id="chat-sidebar-list"></div></div><div id="chat-main"><div id="chat-messages" style="flex:1;overflow-y:auto;padding:1rem"><div class="chat-msg"><div class="sender">System</div><div class="text">Select a session or create a new one to start chatting.</div></div></div><div style="padding:0 1rem 1rem;border-top:1px solid #eee"><div class="chat-input-area"><input type="text" id="chat-input" placeholder="Select a session to chat" disabled /><button class="btn btn-primary" id="send-btn" disabled>Send</button></div><div class="chat-hint">Chat with the blog orchestrator</div></div></div></div><script src="/chat.js"></script>${foot}`;
	return c.html(html);
});

app.get('/chat.js', (c) => {
	const js = `var msg=document.getElementById('chat-messages'),inp=document.getElementById('chat-input'),thi=document.getElementById('chat-thinking'),ws=null,curMsg=null,curText='',streamDone=false,curSid=null;function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}function md(t){var s=esc(t);s=s.replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g,'<pre><code>$2</code></pre>');s=s.replace(/\`([^\`]+)\`/g,'<code>$1</code>');s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');s=s.replace(/\*([^*]+)\*/g,'<em>$1</em>');return s}function formatTime(){var d=new Date(),h=d.getHours().toString().padStart(2,'0'),m=d.getMinutes().toString().padStart(2,'0');return h+':'+m}async function loadSessions(){try{const r=await fetch('/agents/orchestrator'),d=await r.json();if(d.sessions){var lst=document.getElementById('chat-sidebar-list');lst.innerHTML='';d.sessions.forEach(function(s){var div=document.createElement('div');div.className='chat-session-item'+(s.id===curSid?' active':'');div.innerHTML='<span class="name">'+esc(s.name||'Session')+'</span>';div.onclick=function(){selectSession(s.id)};lst.appendChild(div)})}}catch(e){console.error('Failed to load sessions:',e)}}async function newSession(){try{const r=await fetch('/agents/orchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}),s=await r.json();if(s.id){curSid=s.id;loadSessions();clearMessages();inp.disabled=false;document.getElementById('send-btn').disabled=false;inp.focus()}}catch(e){alert('Failed to create session')}}async function selectSession(id){curSid=id;loadSessions();clearMessages();inp.disabled=false;document.getElementById('send-btn').disabled=false;inp.focus()}function clearMessages(){msg.innerHTML=''}function addMessage(role,content){var div=document.createElement('div');div.className='chat-msg';div.innerHTML='<div class="sender">'+(role==='user'?'You':role==='assistant'?'Orchestrator':'System')+'</div><div class="text">'+md(content)+'</div>';msg.appendChild(div);msg.scrollTop=msg.scrollHeight}async function sendMessage(){var text=inp.value.trim();if(!text)return;inp.value='';addMessage('user',text);curMsg=document.createElement('div');curMsg.className='chat-msg';curMsg.innerHTML='<div class="sender">Orchestrator</div><div class="text"></div>';msg.appendChild(curMsg);curText='';streamDone=false;msg.scrollTop=msg.scrollHeight;try{const r=await fetch('/agents/orchestrator/'+curSid+'/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:text,ts:new Date().toISOString()}]})});if(r.ok){const reader=r.body.getReader();const decoder=new TextDecoder;while(true){const {done,value}=await reader.read();if(done)break;curText+=decoder.decode(value);curMsg.querySelector('.text').innerHTML=md(curText);msg.scrollTop=msg.scrollHeight}}streamDone=true}catch(e){curMsg.querySelector('.text').innerHTML='<span style="color:red">Error: '+esc(e.message)+'</span>'}}document.getElementById('send-btn').onclick=sendMessage;inp.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}};loadSessions();`;
	return c.text(js, 200, { 'Content-Type': 'application/javascript' });
});

// ── Flue catch-all (MUST be last) — includes /agents/*, /workflows/*, etc. ──
app.route('/', flue());

export default app;