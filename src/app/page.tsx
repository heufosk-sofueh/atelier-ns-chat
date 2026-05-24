'use client';

import { useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.content }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'エラーが発生しました。' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">アトリエエヌズ AIチャット</h1>
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 border rounded-lg p-4 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center mt-10">メッセージを入力してください</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={msg.role === 'user' ? 'rounded-lg px-4 py-2 max-w-xs bg-blue-500 text-white' : 'rounded-lg px-4 py-2 max-w-xs bg-white border text-gray-800'}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-lg px-4 py-2 text-gray-500">入力中...</div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="メッセージを入力..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          送信
        </button>
      </div>
    </main>
  );
}
