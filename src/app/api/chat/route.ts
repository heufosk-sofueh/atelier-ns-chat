import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SITE_MAP = `
【アトリエエヌズ サイトマップ】
- トップページ: https://atelierns.com/
- 全商品: https://atelierns.com/collections/全商品
- NEW ARRIVAL: https://atelierns.com/collections/new-arrival-1
- SALE: https://atelierns.com/collections/offpriceitem
- トップス: https://atelierns.com/collections/トップス
- シャツ・ブラウス: https://atelierns.com/collections/ブラウス
- カーディガン: https://atelierns.com/collections/カーディガン
- アウター: https://atelierns.com/collections/outer
- ワンピース: https://atelierns.com/collections/ワンピース
- ボトムス: https://atelierns.com/collections/bottoms
- スカート: https://atelierns.com/collections/スカート
- パンツ: https://atelierns.com/collections/パンツ
- ストール・ファッション小物: https://atelierns.com/collections/ストール-ファッション小物
- アクセサリー: https://atelierns.com/collections/アクセサリー
- 五十嵐かほるさんコラボ: https://atelierns.com/collections/kaoruigarashi
- 伊藤美帆さんコラボ: https://atelierns.com/collections/atelier-ns-m
- Life Hapisan コラボ: https://atelierns.com/collections/lifehapisan
- 返品・交換について: https://atelierns.com/pages/返品-交換について
- ご試着無料キャンペーン: https://atelierns.com/pages/goshichakumuryo
- ご試着できる場所: https://atelierns.com/pages/ginzaatelier
- 予約商品について: https://atelierns.com/pages/yoyakusyouhin
- 再入荷通知: https://atelierns.com/pages/完売商品が再入荷した際に教えてほしい
- ご利用案内: https://atelierns.com/pages/userguide
- お問い合わせ: https://atelierns.com/pages/contact
- 営業日・問い合わせ: https://atelierns.com/pages/holiday
`;

const SYSTEM_PROMPT = `あなたはアトリエエヌズ（ATELIER N'S）の公式AIアシスタントです。
お客様のご質問に対して、丁寧で親切な日本語でお答えください。

${SITE_MAP}

【回答ルール】
1. 商品カテゴリーに関する質問には、上記サイトマップの該当URLを必ず案内してください
2. 回答の最後に必ず以下のJSON形式でナビゲーション情報を含めてください：
   <!--NAV:{"label":"〇〇はこちら","url":"https://..."}-->
3. 該当するURLが複数ある場合は複数のNAVタグを含めてください
4. わからない場合や該当ページがない場合は：
   <!--NAV:{"label":"お問い合わせはこちら","url":"https://atelierns.com/pages/contact"}-->
   を含めてください
5. 商品名が具体的に出た場合は商品ページ（https://atelierns.com/products/商品ID）へ案内してください
6. 回答はお客様に寄り添った温かい文章で、簡潔にまとめてください`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    return NextResponse.json({
      content: response.content[0].type === 'text' ? response.content[0].text : '',
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}
