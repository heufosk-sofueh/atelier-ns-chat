'use client';

import { useState, useRef, useEffect } from 'react';

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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const mainRef = useRef<HTMLElement>(null);

  // メッセージ追加・ローディング変化時に最下部へスクロール
  useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // visualViewport APIでキーボード表示時のレイアウト調整（iOS/Android対応）
  useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;

                const handleViewportResize = () => {
                        if (mainRef.current) {
                                  const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;
                                  if (keyboardHeight > 50) {
                                              // キーボード表示中：キーボード分だけ下部オフセット
                                    mainRef.current.style.height = `${viewport.height}px`;
                                              mainRef.current.style.marginTop = `${viewport.offsetTop}px`;
                                  } else {
                                              // キーボード非表示：通常状態に戻す
                                    mainRef.current.style.height = '';
                                              mainRef.current.style.marginTop = '';
                                  }
                        }
                        // キーボード表示後に最下部へスクロール
                        setTimeout(() => {
                                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                };

                viewport.addEventListener('resize', handleViewportResize);
        viewport.addEventListener('scroll', handleViewportResize);
        return () => {
                viewport.removeEventListener('resize', handleViewportResize);
                viewport.removeEventListener('scroll', handleViewportResize);
        };
  }, []);

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
        <main
                ref={mainRef}
                style={{
                          display: 'flex',
                          flexDirection: 'column',
                          // 100dvh: dynamic viewport height でキーボード表示時に自動縮小（iOS/Android対応）
                          // fallback として 100vh も指定
                          height: '100dvh',
                          maxWidth: '640px',
                          margin: '0 auto',
                          padding: '16px',
                          fontFamily: 'sans-serif',
                          // position: fixed でモバイルのスクロールバウンス防止
                          position: 'relative',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                }}
              >
              <h1 style={{ textAlign: 'center', marginBottom: '16px', fontSize: '20px', fontWeight: 'bold', flexShrink: 0 }}>アトリエエヌズ AIチャット</h1>h1>
              <div
                        ref={messagesContainerRef}
                        style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    marginBottom: '16px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    backgroundColor: '#f9fafb',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    // iOS Safari のモーメンタムスクロール有効化
                                    WebkitOverflowScrolling: 'touch' as const,
                                    minHeight: 0,
                        }}
                      >
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
                                              </div>div>
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
                                                                      </a>a>
                                                                    ))}
                                                  </div>div>
                                              )}
                                  </div>div>
                                ))}
                {loading && (
                                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                              <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#6b7280' }}>入力中...</div>div>
                                  </div>div>
                      )}
                {/* スクロール位置マーカー */}
                      <div ref={messagesEndRef} />
              </div>div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <input
                                  ref={inputRef}
                                  type="text"
                                  value={input}
                                  onChange={(e) => setInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(); }}
                                  onFocus={() => {
                                                // フォーカス時に少し待ってから最下部へスクロール（キーボードアニメーション待ち）
                                                setTimeout(() => {
                                                                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                }, 300);
                                  }}
                                  placeholder="メッセージを入力..."
                                  style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '16px', outline: 'none' }}
                                />
                      <button
                                  onClick={() => sendMessage()}
                                  disabled={loading}
                                  style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', opacity: loading ? 0.5 : 1 }}
                                >
                                送信
                      </button>button>
              </div>div>
        </main>main>
      );
}</main>
