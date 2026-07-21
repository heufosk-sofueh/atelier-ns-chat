'use client';

import { useState } from 'react';

type Summary = {
  total: number; conversations: number; user_msgs: number; ai_msgs: number;
  contact_rate: number | null; today_conv: number;
};
type Turn = { t: string; role: string; content: string };
type Conv = { started: string; turns: Turn[] };
type Data = {
  summary: Summary;
  daily: { day: string; conversations: number; user_msgs: number }[];
  topQuestions: { content: string; cnt: number }[];
  ns: { t: string; content: string }[];
  conversations: Conv[];
  unanswered: { t: string; question: string; ai_answer: string }[];
  generatedAt: string;
};

function fmtDT(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function load(pw: string) {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || '読み込みに失敗しました'); setData(null); }
      else { setData(json); }
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  }

  const wrap: React.CSSProperties = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif",
    color: '#1f1f1d', background: '#f7f7f5', minHeight: '100vh',
  };
  const inner: React.CSSProperties = { maxWidth: 920, margin: '0 auto', padding: '24px 18px 60px' };
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e7e3', borderRadius: 12, padding: 18, marginBottom: 18 };

  if (!data) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 380, margin: '0 auto', padding: '80px 18px' }}>
          <h1 style={{ fontSize: 20, marginBottom: 6 }}>ATELIER N&apos;S ログ分析</h1>
          <p style={{ color: '#777', fontSize: 13, marginBottom: 20 }}>閲覧にはパスワードが必要です。</p>
          <form onSubmit={e => { e.preventDefault(); load(password); }}>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="パスワード" autoFocus
              style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 8, marginBottom: 12, boxSizing: 'border-box' }}
            />
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '10px', fontSize: 15, background: '#1f1f1d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              {loading ? '読み込み中…' : '表示する'}
            </button>
          </form>
          {err && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 12 }}>{err}</p>}
        </div>
      </div>
    );
  }

  const s = data.summary;
  const maxConv = Math.max(1, ...data.daily.map(d => d.conversations));

  const kpi = (label: string, value: string | number, color?: string) => (
    <div style={{ ...card, marginBottom: 0, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 650, color: color || '#1f1f1d' }}>{value}</div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={inner}>
        <h1 style={{ fontSize: 20, margin: '0 0 2px' }}>ATELIER N&apos;S AIチャット ログ分析</h1>
        <div style={{ color: '#777', fontSize: 12.5, marginBottom: 20 }}>
          最終更新: {fmtDT(data.generatedAt)}
          <button onClick={() => load(password)} disabled={loading}
            style={{ marginLeft: 10, fontSize: 12, border: '1px solid #ccc', background: '#fff', borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }}>
            {loading ? '更新中…' : '更新'}
          </button>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 26 }}>
          {kpi('総メッセージ数', s.total.toLocaleString())}
          {kpi('会話数（のべ）', s.conversations.toLocaleString())}
          {kpi('本日の会話数', s.today_conv.toLocaleString())}
          {kpi('お問い合わせ誘導率', (s.contact_rate ?? 0) + '%', '#c0392b')}
        </div>

        {/* 日別 */}
        <div style={card}>
          <h2 style={{ fontSize: 14.5, margin: '0 0 14px' }}>日別の利用状況 <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>直近30日（日本時間）</span></h2>
          {data.daily.length === 0 ? <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>まだログがありません。</div> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
              {data.daily.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 10, color: '#666' }}>{d.conversations}</div>
                  <div title={d.day} style={{ width: '70%', background: '#5566cc', borderRadius: '3px 3px 0 0', height: `${(d.conversations / maxConv) * 100}%`, minHeight: 2 }} />
                  <div style={{ fontSize: 9.5, color: '#999', marginTop: 4, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{d.day}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* よく聞かれる質問 */}
        <div style={card}>
          <h2 style={{ fontSize: 14.5, margin: '0 0 12px' }}>よく聞かれている質問 <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>上位20件</span></h2>
          {data.topQuestions.length === 0 ? <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>まだログがありません。</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #eee', color: '#888' }}>質問内容</th><th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #eee', color: '#888' }}>回数</th></tr></thead>
              <tbody>{data.topQuestions.map((q, i) => (
                <tr key={i}><td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f1ef' }}>{q.content}</td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f1ef', textAlign: 'right' }}>{q.cnt}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* NS品番 */}
        <div style={card}>
          <h2 style={{ fontSize: 14.5, margin: '0 0 12px' }}>NS品番を含む問い合わせ <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>最新50件</span></h2>
          {data.ns.length === 0 ? <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>該当なし。</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>{data.ns.map((r, i) => (
                <tr key={i}><td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f1ef', whiteSpace: 'nowrap', color: '#888' }}>{fmtDT(r.t)}</td><td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f1ef' }}>{r.content}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* 会話ログ */}
        <div style={card}>
          <h2 style={{ fontSize: 14.5, margin: '0 0 12px' }}>会話ログ（質問と回答） <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>新しい会話順・全文</span></h2>
          {data.conversations.length === 0 ? <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>まだログがありません。</div> :
            data.conversations.map((c, i) => (
              <div key={i} style={{ border: '1px solid #ececea', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ background: '#fafaf8', padding: '8px 12px', fontSize: 12, color: '#888' }}>{fmtDT(c.started)}〜</div>
                <div style={{ padding: '6px 12px 12px' }}>
                  {c.turns.map((t, j) => (
                    <div key={j} style={{ padding: '9px 0', borderBottom: j < c.turns.length - 1 ? '1px solid #f3f3f0' : 'none' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3, color: t.role === 'user' ? '#1a9a6a' : '#5566cc' }}>{t.role === 'user' ? 'お客様' : 'AI'}</div>
                      <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* 答えきれなかった会話（最後） */}
        <div style={{ ...card, borderColor: '#f0d9b5', background: '#fffdf8' }}>
          <h2 style={{ fontSize: 14.5, margin: '0 0 4px' }}>⚠️ 答えきれなかった会話 <span style={{ fontSize: 11.5, color: '#999', fontWeight: 400 }}>要確認・新しい順</span> {data.unanswered.length > 0 && <span style={{ fontSize: 12, color: '#666' }}>／ {data.unanswered.length}件</span>}</h2>
          <p style={{ fontSize: 12, color: '#999', margin: '2px 0 12px' }}>商品を特定できなかった・FAQに記載がない等で、AIが確答できず案内に留めた会話です。FAQ／商品情報の追加で減らせます。</p>
          {data.unanswered.length === 0 ? <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>該当なし。すべて確答できています。</div> :
            data.unanswered.map((u, i) => (
              <div key={i} style={{ border: '1px solid #f0d9b5', background: '#fff', borderRadius: 10, marginBottom: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>{fmtDT(u.t)}</div>
                <div style={{ fontSize: 13.5, marginBottom: 5 }}><b style={{ color: '#1a9a6a' }}>お客様：</b>{u.question || '(不明)'}</div>
                <div style={{ fontSize: 13, color: '#333' }}><b style={{ color: '#5566cc' }}>AI：</b>{u.ai_answer}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
