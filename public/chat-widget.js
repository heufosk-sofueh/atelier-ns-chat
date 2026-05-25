(function() {
  if (window.__atelierNsChatLoaded) return;
  window.__atelierNsChatLoaded = true;

  const CHAT_API = 'https://atelier-ns-chat.vercel.app/api/chat';

  const styles = `
    #ans-chat-btn {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #7c3aed; color: white; border: none;
      cursor: pointer; font-size: 26px;
      box-shadow: 0 4px 16px rgba(124,58,237,0.4);
      z-index: 99999; display: flex;
      align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    #ans-chat-btn:hover { transform: scale(1.1); }
    #ans-chat-window {
      position: fixed; bottom: 148px; right: 24px;
      width: 360px; height: 520px; background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      z-index: 99998; display: none;
      flex-direction: column; overflow: hidden;
      font-family: sans-serif;
    }
    #ans-chat-window.open { display: flex; }
    #ans-chat-header {
      background: #7c3aed; color: white;
      padding: 14px 16px; font-weight: bold; font-size: 15px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #ans-chat-close {
      background: none; border: none; color: white;
      font-size: 20px; cursor: pointer; line-height: 1;
    }
    #ans-chat-messages {
      flex: 1; overflow-y: auto; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
      background: #f9fafb;
    }
    .ans-msg-wrap { display: flex; flex-direction: column; }
    .ans-msg-wrap.user { align-items: flex-end; }
    .ans-msg-wrap.assistant { align-items: flex-start; }
    .ans-msg-bubble {
      padding: 9px 13px; border-radius: 12px; max-width: 82%;
      font-size: 14px; line-height: 1.6; white-space: pre-wrap;
    }
    .ans-msg-wrap.user .ans-msg-bubble { background: #7c3aed; color: white; }
    .ans-msg-wrap.assistant .ans-msg-bubble {
      background: white; border: 1px solid #e5e7eb; color: #1f2937;
    }
    .ans-nav-buttons {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-top: 6px; max-width: 90%;
    }
    .ans-nav-btn {
      display: inline-block; padding: 5px 12px;
      background: #f3e8ff; color: #7c3aed;
      border-radius: 20px; border: 1px solid #c4b5fd;
      text-decoration: none; font-size: 13px; font-weight: 500;
    }
    .ans-typing {
      color: #9ca3af; font-size: 13px; padding: 6px 10px;
    }
    #ans-chat-input-area {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid #e5e7eb; background: white;
    }
    #ans-chat-input {
      flex: 1; border: 1px solid #d1d5db; border-radius: 8px;
      padding: 8px 12px; font-size: 14px; outline: none;
    }
    #ans-chat-send {
      background: #7c3aed; color: white; border: none;
      border-radius: 8px; padding: 8px 14px;
      font-size: 14px; font-weight: bold; cursor: pointer;
    }
    #ans-chat-send:disabled { opacity: 0.5; cursor: default; }
    @media (max-width: 480px) {
      #ans-chat-window {
        width: 100vw;
        right: 0;
        left: 0;
        bottom: 0;
        top: 0;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
      #ans-chat-btn {
        bottom: 16px;
        right: 16px;
      }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const btn = document.createElement('button');
  btn.id = 'ans-chat-btn';
  btn.innerHTML = '💬';
  btn.title = 'AIスタッフに質問する';
  document.body.appendChild(btn);

  const win = document.createElement('div');
  win.id = 'ans-chat-window';
  win.innerHTML = `
    <div id="ans-chat-header">
      <span>AIスタッフ</span>
      <button id="ans-chat-close">✕</button>
    </div>
    <div id="ans-chat-messages"></div>
    <div id="ans-chat-input-area">
      <input id="ans-chat-input" type="text" placeholder="ご質問をどうぞ..." />
      <button id="ans-chat-send">送信</button>
    </div>
  `;
  document.body.appendChild(win);

  const messagesEl = win.querySelector('#ans-chat-messages');
  const inputEl = win.querySelector('#ans-chat-input');
  const sendBtn = win.querySelector('#ans-chat-send');
  const closeBtn = win.querySelector('#ans-chat-close');

  let messages = [];
  let isComposing = false;

  function parseMessage(raw) {
    const navButtons = [];
    const regex = /<!--NAV:(.*?)-->/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      try { navButtons.push(JSON.parse(match[1])); } catch(e) {}
    }
    const text = raw.replace(/<!--NAV:.*?-->/g, '').trim();
    return { text, navButtons };
  }

  function addMessage(role, text, navButtons) {
    const wrap = document.createElement('div');
    wrap.className = 'ans-msg-wrap ' + role;
    const bubble = document.createElement('div');
    bubble.className = 'ans-msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    if (navButtons && navButtons.length > 0) {
      const navWrap = document.createElement('div');
      navWrap.className = 'ans-nav-buttons';
      navButtons.forEach(function(nb) {
        const a = document.createElement('a');
        a.className = 'ans-nav-btn';
        a.textContent = nb.label + ' →';
        a.href = nb.url;
        navWrap.appendChild(a);
      });
      wrap.appendChild(navWrap);
    }
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'ans-typing';
    el.id = 'ans-typing';
    el.textContent = '入力中...';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('ans-typing');
    if (el) el.remove();
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;
    inputEl.value = '';
    messages.push({ role: 'user', content: text });
    addMessage('user', text, []);
    sendBtn.disabled = true;
    showTyping();
    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages })
      });
      const data = await res.json();
      const { text: parsed, navButtons } = parseMessage(data.content);
      messages.push({ role: 'assistant', content: parsed });
      hideTyping();
      addMessage('assistant', parsed, navButtons);
    } catch(e) {
      hideTyping();
      addMessage('assistant', 'エラーが発生しました。しばらく後にお試しください。', []);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  addMessage('assistant', 'こんにちは！アトリエエヌズのAIスタッフです。\nご質問はお気軽にどうぞ！', [
    { label: '全商品を見る', url: 'https://atelierns.com/collections/%E5%85%A8%E5%95%86%E5%93%81' },
    { label: 'SALE', url: 'https://atelierns.com/collections/offpriceitem' }
  ]);

  btn.addEventListener('click', function() {
    win.classList.toggle('open');
    if (win.classList.contains('open')) inputEl.focus();
  });

  closeBtn.addEventListener('click', function() {
    win.classList.remove('open');
  });

  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('compositionstart', function() { isComposing = true; });
  inputEl.addEventListener('compositionend', function() { isComposing = false; });
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !isComposing) sendMessage();
  });
})();
