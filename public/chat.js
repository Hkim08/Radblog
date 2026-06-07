(function() {
  'use strict';

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

  function formatMessage(text) {
    var html = escapeHtml(text);
    html = html.replace(/&lt;pre&gt;/g, '<pre>').replace(/&lt;\/pre&gt;/g, '</pre>');
    html = html.replace(/&lt;code&gt;/g, '<code>').replace(/&lt;\/code&gt;/g, '</code>');
    html = html.replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');
    html = html.replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
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
        '<div class="msg-body"><div class="msg-content">' + formatMessage(m.content) + '</div></div>';
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
    div.innerHTML = '<div class="msg-avatar">A</div><div class="msg-body"><div class="msg-content">' + formatMessage(text) + '</div></div>';
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
    userDiv.innerHTML = '<div class="msg-avatar">Y</div><div class="msg-body"><div class="msg-content">' + formatMessage(text) + '</div></div>';
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
          lastMsg.innerHTML = formatMessage(fullResponse);
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