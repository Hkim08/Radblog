/**
 * Cloudflare Workers app entry point.
 * Simple, clean chat interface with Flue agent integration.
 */
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';

const app = new Hono();

// ── Simple landing page ──────────────────────────────────────────────────────
app.get('/', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Radblog - AI Blog Engine</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; min-height: 100vh; }
    nav { background: #1a1a1a; padding: 1rem 2rem; display: flex; gap: 1.5rem; align-items: center; }
    nav a { color: #fff; text-decoration: none; font-size: 0.95rem; padding: 0.25rem 0.5rem; border-radius: 4px; }
    nav a:hover { background: rgba(255,255,255,0.1); }
    nav .brand { font-weight: 700; font-size: 1.1rem; margin-right: auto; }
    .container { max-width: 800px; margin: 3rem auto; padding: 0 1.5rem; text-align: center; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 1.1rem; margin-bottom: 2rem; }
    .btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-size: 1rem; font-weight: 500; background: #10a37f; color: #fff; }
    .btn:hover { background: #0d8a6a; }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="brand">Radblog</a>
    <a href="/chat">Chat</a>
  </nav>
  <div class="container">
    <h1>AI Blog Engine</h1>
    <p>Create, optimize, and manage blog content with AI-powered workflows</p>
    <a href="/chat" class="btn">Open Chat</a>
  </div>
</body>
</html>`)
);

// ── Chat page - simple HTML string ──────────────────────────────────────────
app.get('/chat', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat - Radblog</title>
  <style>
    :root { --bg: #fff; --bg2: #f7f7f8; --bg3: #ececf1; --bd: #e5e5e5; --tx: #1a1a1a; --tx2: #666; --tx3: #999; --ac: #10a37f; --ac2: #0d8a6a; }
    @media (prefers-color-scheme: dark) { :root { --bg: #212121; --bg2: #2d2d2d; --bg3: #404040; --bd: #404040; --tx: #ececf1; --tx2: #a0a0a0; --tx3: #666; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--tx); display: flex; }
    .app { display: flex; width: 100%; height: 100vh; overflow: hidden; }
    .sidebar { width: 260px; background: var(--bg2); border-right: 1px solid var(--bd); display: flex; flex-direction: column; flex-shrink: 0; }
    .sidebar-header { padding: 14px 16px; border-bottom: 1px solid var(--bd); display: flex; align-items: center; justify-content: space-between; }
    .sidebar-title { font-size: 13px; font-weight: 600; }
    .btn-new { background: var(--ac); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500; }
    .btn-new:hover { background: var(--ac2); }
    .sidebar-list { flex: 1; overflow-y: auto; padding: 8px; }
    .session { display: flex; align-items: center; padding: 8px 10px; border-radius: 6px; cursor: pointer; margin-bottom: 2px; }
    .session:hover { background: var(--bg3); }
    .session.active { background: var(--bg3); font-weight: 500; }
    .session-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .session-del { opacity: 0; color: var(--tx3); background: none; border: none; cursor: pointer; padding: 2px 6px; font-size: 14px; border-radius: 4px; }
    .session:hover .session-del { opacity: 1; }
    .session-del:hover { color: #ef4444; }
    .chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .chat-header { padding: 12px 20px; border-bottom: 1px solid var(--bd); display: flex; align-items: center; gap: 12px; }
    .chat-header h2 { font-size: 14px; font-weight: 600; }
    .badge { font-size: 11px; color: var(--tx3); background: var(--bg2); padding: 3px 8px; border-radius: 10px; }
    .messages { flex: 1; overflow-y: auto; padding: 20px; }
    .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--tx3); }
    .empty h2 { font-size: 18px; color: var(--tx); margin-bottom: 6px; }
    .empty p { font-size: 13px; }
    .msg { display: flex; gap: 12px; margin-bottom: 20px; }
    .msg.user { flex-direction: row-reverse; }
    .msg-avatar { width: 28px; height: 28px; border-radius: 5px; background: var(--ac); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
    .msg-body { max-width: 600px; font-size: 14px; line-height: 1.5; }
    .msg.user .msg-body { background: var(--ac); color: #fff; padding: 8px 12px; border-radius: 12px 12px 4px 12px; }
    .msg-content { white-space: pre-wrap; word-break: break-word; }
    .typing { display: flex; gap: 4px; padding: 4px 0; }
    .typing span { width: 6px; height: 6px; background: var(--tx3); border-radius: 50%; animation: dot 1.2s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dot { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
    .input-area { padding: 12px 16px 16px; border-top: 1px solid var(--bd); }
    .input-box { display: flex; gap: 8px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 12px; padding: 8px 12px; }
    .input-box:focus-within { border-color: var(--ac); }
    .input-box textarea { flex: 1; border: none; background: transparent; resize: none; font-size: 14px; color: var(--tx); outline: none; min-height: 22px; max-height: 120px; font-family: inherit; line-height: 1.4; }
    .input-box textarea::placeholder { color: var(--tx3); }
    .btn-send { background: var(--ac); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; align-self: flex-end; }
    .btn-send:hover { background: var(--ac2); }
    .btn-send:disabled { opacity: 0.4; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Sessions</span>
        <button class="btn-new" id="btnNew">+ New</button>
      </div>
      <div class="sidebar-list" id="sessionList"></div>
    </aside>
    <main class="chat">
      <header class="chat-header">
        <h2 id="chatTitle">New Chat</h2>
        <span class="badge">Orchestrator</span>
      </header>
      <div class="messages" id="messages">
        <div class="empty">
          <h2>Start a conversation</h2>
          <p>Ask me anything about blog writing, SEO, or content strategy.</p>
        </div>
      </div>
      <div class="input-area">
        <div class="input-box">
          <textarea id="input" placeholder="Type a message..." rows="1"></textarea>
          <button class="btn-send" id="btnSend">Send</button>
        </div>
      </div>
    </main>
  </div>
  <script>
(function() {
  var currentSession = null;
  var sessions = [];
  var isGenerating = false;

  var elSessionList = document.getElementById('sessionList');
  var elMessages = document.getElementById('messages');
  var elChatTitle = document.getElementById('chatTitle');
  var elInput = document.getElementById('input');
  var elBtnSend = document.getElementById('btnSend');
  var elBtnNew = document.getElementById('btnNew');

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderSessions() {
    elSessionList.innerHTML = '';
    sessions.forEach(function(s) {
      var div = document.createElement('div');
      div.className = 'session' + (s.id === currentSession ? ' active' : '');
      div.innerHTML = '<span class="session-name">' + escapeHtml(s.name || 'New Chat') + '</span>' +
        '<button class="session-del" data-id="' + s.id + '">x</button>';
      div.addEventListener('click', function(e) {
        if (e.target.classList.contains('session-del')) {
          deleteSession(e.target.dataset.id);
        } else {
          selectSession(s.id);
        }
      });
      elSessionList.appendChild(div);
    });
  }

  function renderMessages(msgs) {
    if (!msgs || msgs.length === 0) {
      elMessages.innerHTML = '<div class="empty"><h2>Start a conversation</h2><p>Ask me anything about blog writing, SEO, or content strategy.</p></div>';
      return;
    }
    elMessages.innerHTML = '';
    msgs.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'msg ' + m.role;
      div.innerHTML = '<div class="msg-avatar">' + (m.role === 'user' ? 'Y' : 'A') + '</div>' +
        '<div class="msg-body"><div class="msg-content">' + escapeHtml(m.content) + '</div></div>';
      elMessages.appendChild(div);
    });
    elMessages.scrollTop = elMessages.scrollHeight;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'msg assistant';
    div.id = 'typing';
    div.innerHTML = '<div class="msg-avatar">A</div><div class="msg-body"><div class="typing"><span></span><span></span><span></span></div></div>';
    elMessages.appendChild(div);
    elMessages.scrollTop = elMessages.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('typing');
    if (el) el.remove();
  }

  function addAssistantMessage(text) {
    var div = document.createElement('div');
    div.className = 'msg assistant';
    div.innerHTML = '<div class="msg-avatar">A</div><div class="msg-body"><div class="msg-content">' + escapeHtml(text) + '</div></div>';
    elMessages.appendChild(div);
    elMessages.scrollTop = elMessages.scrollHeight;
  }

  async function loadSessions() {
    try {
      var res = await fetch('/agents/orchestrator');
      if (res.ok) {
        var data = await res.json();
        sessions = data.sessions || [];
        renderSessions();
      }
    } catch (e) { console.error('Load sessions error:', e); }
  }

  async function loadMessages(sessionId) {
    try {
      var res = await fetch('/agents/orchestrator/' + sessionId + '/messages');
      if (res.ok) {
        var data = await res.json();
        return data.messages || [];
      }
    } catch (e) { console.error('Load messages error:', e); }
    return [];
  }

  async function createSession() {
    try {
      var res = await fetch('/agents/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        var session = await res.json();
        currentSession = session.id;
        elChatTitle.textContent = session.name || 'New Chat';
        renderMessages([]);
        renderSessions();
        loadSessions();
      }
    } catch (e) { console.error('Create session error:', e); }
  }

  async function deleteSession(sessionId) {
    try {
      await fetch('/agents/orchestrator/' + sessionId, { method: 'DELETE' });
      if (currentSession === sessionId) {
        currentSession = null;
        elChatTitle.textContent = 'New Chat';
        renderMessages([]);
      }
      loadSessions();
    } catch (e) { console.error('Delete session error:', e); }
  }

  async function selectSession(sessionId) {
    currentSession = sessionId;
    var session = sessions.find(function(s) { return s.id === sessionId; });
    elChatTitle.textContent = session ? (session.name || 'New Chat') : 'New Chat';
    renderSessions();
    var msgs = await loadMessages(sessionId);
    renderMessages(msgs);
  }

  async function sendMessage() {
    var text = elInput.value.trim();
    if (!text || !currentSession || isGenerating) return;

    isGenerating = true;
    elBtnSend.disabled = true;
    elInput.value = '';

    var userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.innerHTML = '<div class="msg-avatar">Y</div><div class="msg-body"><div class="msg-content">' + escapeHtml(text) + '</div></div>';
    elMessages.appendChild(userDiv);
    elMessages.scrollTop = elMessages.scrollHeight;

    showTyping();

    try {
      var res = await fetch('/agents/orchestrator/' + currentSession + '/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: text, ts: new Date().toISOString() }] })
      });

      hideTyping();

      if (res.ok && res.body) {
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var fullResponse = '';

        addAssistantMessage('');
        var lastMsg = elMessages.lastChild.querySelector('.msg-content');

        while (true) {
          var result = await reader.read();
          if (result.done) break;
          fullResponse += decoder.decode(result.value);
          lastMsg.textContent = fullResponse;
          elMessages.scrollTop = elMessages.scrollHeight;
        }
      } else {
        addAssistantMessage('Error: Could not get response');
      }
    } catch (e) {
      hideTyping();
      addAssistantMessage('Error: ' + e.message);
    }

    isGenerating = false;
    elBtnSend.disabled = false;
    elInput.focus();
  }

  elBtnNew.addEventListener('click', createSession);
  elBtnSend.addEventListener('click', sendMessage);
  elBtnNew.addEventListener('click', createSession);
  elInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  elInput.addEventListener('input', function() {
    elInput.style.height = 'auto';
    elInput.style.height = Math.min(elInput.scrollHeight, 120) + 'px';
  });

  loadSessions();
})();
  </script>
</body>
</html>`)
);

// ── Flue catch-all (MUST be last) ──
app.route('/', flue());

export default app;