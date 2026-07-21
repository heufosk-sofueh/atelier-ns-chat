// 管理ダッシュボード用API：chat_logs を集計して返す（パスワード保護）
// パスワードは環境変数 ADMIN_PASSWORD（Vercelで設定）と照合する。
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Row = { session_id: string; role: string; content: string; created_at: string };

const NS_RE = /NS[\s　\-－_]*\d{3,4}/i;
const UNANSWERED_MARKERS = [
  '確認できませんでした', '確認することができませんでした', '記載がございません',
  '情報がございませんでした', 'どの商品', '品番をお教え', '商品名や品番',
  '品番や商品名', '取り扱いがございません', '確認させていただけ',
];
function isUnanswered(c: string): boolean {
  if (UNANSWERED_MARKERS.some(m => c.includes(m))) return true;
  if (c.includes('FAQ') && c.includes('記載')) return true;
  return false;
}
function stripNav(s: string): string {
  return (s || '').replace(/<!--NAV:[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
// JSTの YYYY-MM-DD / MM/DD を取得
function jstDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).replace(/\//g, '-'); // 2026-06-18
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json({ error: 'ADMIN_PASSWORD が未設定です。Vercelの環境変数に設定してください。' }, { status: 500 });
    }
    if (!password || password !== expected) {
      return NextResponse.json({ error: 'パスワードが違います。' }, { status: 401 });
    }
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase が未設定です。' }, { status: 500 });
    }

    // 直近5000件を取得して集計（ページングで取得）
    const rows: Row[] = [];
    const pageSize = 1000;
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('session_id, role, content, created_at')
        .order('created_at', { ascending: false })
        .range(i * pageSize, i * pageSize + pageSize - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < pageSize) break;
    }

    // 正確な累計件数
    const { count: totalAll } = await supabase
      .from('chat_logs').select('*', { count: 'exact', head: true });

    const asc = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // サマリー
    const sessions = new Set(rows.map(r => r.session_id));
    const userMsgs = rows.filter(r => r.role === 'user');
    const aiMsgs = rows.filter(r => r.role === 'assistant');
    const aiContact = aiMsgs.filter(r => r.content.includes('お問い合わせ')).length;
    const contactRate = aiMsgs.length ? Math.round((aiContact / aiMsgs.length) * 1000) / 10 : null;
    const todayJst = jstDate(new Date().toISOString());
    const todayConv = new Set(rows.filter(r => jstDate(r.created_at) === todayJst).map(r => r.session_id)).size;

    // 日別（直近30日）
    const dayMap = new Map<string, { conv: Set<string>; user: number }>();
    for (const r of rows) {
      const d = jstDate(r.created_at);
      if (!dayMap.has(d)) dayMap.set(d, { conv: new Set(), user: 0 });
      const e = dayMap.get(d)!;
      e.conv.add(r.session_id);
      if (r.role === 'user') e.user++;
    }
    const daily = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([d, e]) => ({ day: d.slice(5).replace('-', '/'), conversations: e.conv.size, user_msgs: e.user }));

    // よく聞かれる質問 TOP20
    const qMap = new Map<string, number>();
    for (const r of userMsgs) qMap.set(r.content, (qMap.get(r.content) || 0) + 1);
    const topQuestions = [...qMap.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 20).map(([content, cnt]) => ({ content, cnt }));

    // NS品番を含む問い合わせ（最新50）
    const ns = userMsgs.filter(r => NS_RE.test(r.content)).slice(0, 50)
      .map(r => ({ t: r.created_at, content: r.content }));

    // 会話ログ（最新20会話・全文）
    const bySession = new Map<string, Row[]>();
    for (const r of asc) {
      if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
      bySession.get(r.session_id)!.push(r);
    }
    const convList = [...bySession.values()]
      .sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime())
      .slice(0, 20)
      .map(turns => ({
        started: turns[0].created_at,
        turns: turns.map(t => ({ t: t.created_at, role: t.role, content: stripNav(t.content) })),
      }));

    // 答えきれなかった会話（質問とAI回答のペア）
    const unanswered: { t: string; question: string; ai_answer: string }[] = [];
    for (const turns of bySession.values()) {
      for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        if (t.role === 'assistant' && isUnanswered(t.content)) {
          let q = '';
          for (let j = i; j >= 0; j--) { if (turns[j].role === 'user') { q = turns[j].content; break; } }
          unanswered.push({ t: t.created_at, question: q, ai_answer: stripNav(t.content) });
        }
      }
    }
    unanswered.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());

    return NextResponse.json({
      summary: {
        total: totalAll ?? rows.length,
        conversations: sessions.size,
        user_msgs: userMsgs.length,
        ai_msgs: aiMsgs.length,
        contact_rate: contactRate,
        today_conv: todayConv,
      },
      daily, topQuestions, ns, conversations: convList, unanswered,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
