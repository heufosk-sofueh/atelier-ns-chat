'use client';

import { useState } from 'react';

type NavButton = {
  label: string;
  url: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  navButtons?: NavButton[];
};

function parseMessage(raw: string): { text: string; navButtons: NavButton[] } {
  const navButtons: NavButton[] = [];
  const regex = /<!--NAV:(.*?)-->/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    try {
      const btn = JSON.parse(match[1]);
      navButtons.push(btn);
    } catch {}
  }
  const text = raw.replace(/<!--NAV:.*?-->/g, '').trim();
  return { text, navButtons };
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'こんにちは！アトリエエヌズのAIアシスタントです。\nお探しの商品やご質問はありますか？',
  navButtons: [
    { label: '全商品を見る', url: 'https://atelierns.com/collections/%E5%85%A8%E5%95%86%E5%93%81' },
    { label: '新着商品', url: 'https://atelierns.com/collections/new-arrival-1' },
    { label: 'SALE', url: 'https://atelierns.com/collections/offpriceitem' },
  ],
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      const { text: parsedText, navButtons } = parseMessage(data.content);
      setMessages([...newMessages, { role: 'assistant', content: parsedText, navButtons }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'エラーが発生しました。' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '640px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>アトリエエヌズ AIチャット</h1>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '12px',
              maxWidth: '80%',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#ffffff',
              color: msg.role === 'user' ? '#ffffff' : '#1f2937',
              border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
            }}>
              {msg.content}
            </div>
            {msg.navButtons && msg.navButtons.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', maxWidth: '80%' }}>
                {msg.navButtons.map((btn, j) => (
                  <a
                    key={j}
                    href={btn.url}
                    style={{
                      display: 'inline-block',
                      padding: '6px 14px',
                      backgroundColor: '#f3e8ff',
                      color: '#7c3aed',
                      borderRadius: '20px',
                      border: '1px solid #c4b5fd',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    {btn.label} →
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#6b7280' }}>入力中...</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(); }}
          placeholder="メッセージを入力..."
          style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '16px', outline: 'none' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading}
          style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', opacity: loading ? 0.5 : 1 }}
        >
          送信
        </button>
      </div>
    </main>
  );
}
