// Fix: keep product context across conversation turns for NAV buttons
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { FAQ_DATA } from './faq-data';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Supabase クライアント（RAG用）
// 環境変数が未設定の場合は RAG をスキップして既存動作にフォールバック
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

const supabase = supabaseUrl && supabaseKe
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const openai = openaiKey
  ? new OpenAI({ apiKey: openaiKey })
  : null;

const SITE_MAP = `
【アトリエエヌズ カテゴリーURL】
- トップページ: https://atelierns.com/
- 全商品: https://atelierns.com/collections/%E5%85%A8%E5%95%86%E5%93%81
- NEW ARRIVAL: https://atelierns.com/collections/new-arrival-1
- SALE: https://atelierns.com/collections/offpriceitem
- トップス: https://atelierns.com/collections/%E3%83%88%E3%83%83%E3%83%97%E3%82%B9
- シャツ・ブラウス: https://atelierns.com/collections/%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B9
- カーディガン: https://atelierns.com/collections/%E3%82%AB%E3%83%BC%E3%83%87%E3%82%A3%E3%82%AC%E3%83%B3
- アウター: https://atelierns.com/collections/outer
- ワンピース: https://atelierns.com/collections/%E3%83%AF%E3%83%B3%E3%83%94%E3%83%BC%E3%82%B9
- ボトムス: https://atelierns.com/collections/bottoms
- スカート: https://atelierns.com/collections/%E3%82%B9%E3%82%AB%E3%83%BC%E3%83%88
- パンツ: https://atelierns.com/collections/%E3%83%91%E3%83%B3%E3%83%84
- ストール・ファッション小物: https://atelierns.com/collections/%E3%82%B9%E3%83%88%E3%83%BC%E3%83%AB-%E3%83%95%E3%82%A1%E3%83%83%E3%82%B7%E3%83%A7%E3%83%B3%E5%B0%8F%E7%89%A9
- アクセサリー: https://atelierns.com/collections/%E3%82%A2%E3%82%AF%E3%82%BB%E3%82%B5%E3%83%AA%E3%83%BC
- 五十嵐かほるさんコラボ: https://atelierns.com/collections/kaoruigarashi
- 伊藤美帆さんコラボ: https://atelierns.com/collections/atelier-ns-m
- Life Hapisan コラボ: https://atelierns.com/collections/lifehapisan
- 返品・返金ポリシー: https://atelierns.com/policies/refund-policy
- 配送ポリシー: https://atelierns.com/policies/shipping-policy
- ご試着無料キャンペーン: https://atelierns.com/pages/goshichakumuryo
- ご試着できる場所: https://atelierns.com/pages/ginzaatelier
- 予約商品について: https://atelierns.com/pages/yoyakusyouhin
- ご利用案内: https://atelierns.com/pages/userguide
- お問い合わせ: https://atelierns.com/pages/contact
- 営業日・問い合わせ: https://atelierns.com/pages/holiday
- メールが届かない場合: https://atelierns.com/pages/careermail
- 注文商品が届かない場合: https://atelierns.com/pages/cyuumonsyouhin
`;

type Message = { role: string; content: string };

type Product = {
  title: string;
  handle: string;
  url: string;
};

// ===== [1] 会話履歴からNS品番を抽出 =====
// 半角/全角スペース・ハイフン・アンダースコアすべてに対応
function extractProductKeywordsFromHistory(messages: Message[]): string[] {
  const keywords: string[] = [];
  const recentMessages = messages.slice(-5);
  for (const msg of recentMessages) {
            const codeMatches = msg.content.match(/NS[\s\u3000\-\uff0d_]*\d{3,4}/gi) ?? [];
    keywords.push(
            ...codeMatches.map(k => k.replace(/[\s\u3000\-\uff0d_]+/g, '-').toUpperCase())
    );
  }
  return [...new Set(keywords)];
}

async function searchProducts(query: string): Promise<Product[]> {
  try {
    const results: Product[] = [];
    let page = 1;
    const keywords = query.toLowerCase().replace(/s/g, '');

    while (page <= 10) {
      const res = await fetch(`https://atelierns.com/products.json?limit=250&page=${page}`);
      const data = await res.json();
      if (!data.products || data.products.length === 0) break;

      for (const p of data.products) {
        const title = p.title.toLowerCase().replace(/s/g, '');
        if (title.includes(keywords) || keywords.includes(title.slice(0, 4))) {
          results.push({
            title: p.title,
            handle: p.handle,
            url: `https://atelierns.com/products/${p.handle}`,
          });
        }
      }
      if (results.length >= 5) break;
      page++;
    }
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// ===== RAG: ユーザーの質問に関連するチャンクを Supabase から検索 =====
async function searchRAG(query: string): Promise<string> {
  if (!supabase || !openai) return '';
  try {
    // 質問をベクトル化
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const embedding = embeddingRes.data[0].embedding;

    // Supabase pgvector で類似度検索（上位3件）
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 3,
    });

    if (error || !data || data.length === 0) return '';

    const chunks = data.map((d: { url: string; title: string; content: string }) =>
      `【参考ページ: ${d.title}（${d.url}）】
${d.content}`
    );
        return `\n【RAGで取得したサイト情報】\n` + chunks.join('\n\n');
  }     catch (e) {
    console.error('RAG search error:', e);
    return '';
  }
}
// ===== ここまで RAG =====

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // ===== [1] 商品検索：現ターン → ヒットなければ履歴キーワードで再検索 =====
    let products = await searchProducts(lastUserMessage);
    let historyKeywords: string[] = [];

    if (products.length === 0 && messages.length > 1) {
      historyKeywords = extractProductKeywordsFromHistory(messages.slice(0, -1));
      if (historyKeywords.length > 0) {
        for (const kw of historyKeywords) {
          const fallback = await searchProducts(kw);
          if (fallback.length > 0) {
            products = fallback;
            break;
          }
        }
      }
    }

    // ===== [5] RAGは「履歴品番 + 現ターン」で検索してコンテキスト精度を向上 =====
    const ragQuery = historyKeywords.length > 0
      ? `${historyKeywords[0]} ${lastUserMessage}`
      : lastUserMessage;
    const ragContext = await searchRAG(ragQuery);

    const productInfo = products.length > 0
      ? `
【検索結果】以下の商品が見つかりました:
` +
        products.map(p => `- ${p.title}: ${p.url}`).join('\n')
            : `\n【検索結果】該当する商品は見つかりませんでした。`;

    const systemPrompt = `あなたはアトリエエヌズ（ATELIER N'S）の公式AIアシスタントです。
お客様のご質問に対して、丁寧で親切な日本語でお答えください。
${SITE_MAP}
${productInfo}
${ragContext}
【サイト公式FAQ・ポリシー情報】
以下はサイトから収集した正確な情報です。必ずこの情報のみを使用し、推測で答えないでください：
${FAQ_DATA}
【会話コンテキストの引き継ぎ】
直近の会話で特定の商品（例: NS-306、フロントツイストタックワンピースなど）について話している場合、その商品を会話コンテキストとして必ず保持してください。
「サイズは？」「在庫ある？」「素材は？」「リンクをください」「商品ページはどこ？」などのフォローアップ質問でも、その商品の商品ページNAVボタンを必ず最優先で最初に表示してください。
下記【検索結果】にその商品が含まれている場合はそのURLを使用し、含まれていない場合でも会話から分かる商品名でNAVを構成してください。
【NAVボタン生成の必須ルール】
以下の優先順位でNAVボタンを必ず生成してください：
1. 直近の会話で特定された商品がある → その商品ページのNAVを最優先で最初に置く
2. カテゴリが分かる → カテゴリNAVを追加
3. 何も分からない → 全商品 or お問い合わせNAV
【禁止表現】
「URLを取得できません」「直接の商品ページURLを現在取得することができませんでした」「リンクをお伝えできません」といった表現は絶対に使わないでください。
商品ページへの案内は必ずNAVボタンで行い、「下のボタンから商品ページをご覧いただけます」のように案内してください。
【回答ルール】
1. 回答本文にURLやリンクは一切書かないでください
2. ポリシー・返品・配送・キャンペーン・営業日に関する質問は、必ず上記【サイト公式FAQ・ポリシー情報】と【RAGで取得したサイト情報】に明記されている内容だけを使用してください。記載がないことは絶対に補足・推測・断言しないでください
3. FAQに記載がない内容・お客様の希望に完全には応えられない場合は、「詳細はお問い合わせください」と案内し、必ずお問い合わせページのNAVボタンを末尾に追加してください
4. FAQに記載があり、明確に回答できる場合はお問い合わせボタンは不要です（ただし関連ページへのNAVボタンは付けてください）
5. 商品が見つかった場合は、上記【検索結果】の正確なURLのみを使用してください
6. 回答の最後に以下のJSON形式でナビゲーションボタン情報を含めてください（本文ではなくボタンとして表示されます）：
<!--NAV:{"label":"ページ名はこちら","url":"https://atelierns.com/..."}-->
7. 複数案内する場合はNAVタグを複数並べてください
8. 回答は3〜5文程度の簡潔な文章にしてください。箇条書きや区切り線は使わないでください`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    return NextResponse.json({
      content: response.content[0].type === 'text' ? response.content[0].text : '',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
