import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
- 返品・交換について: https://atelierns.com/pages/%E8%BF%94%E5%93%81-%E4%BA%A4%E6%8F%9B%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6
- ご試着無料キャンペーン: https://atelierns.com/pages/goshichakumuryo
- ご試着できる場所: https://atelierns.com/pages/ginzaatelier
- 予約商品について: https://atelierns.com/pages/yoyakusyouhin
- ご利用案内: https://atelierns.com/pages/userguide
- お問い合わせ: https://atelierns.com/pages/contact
- 営業日・問い合わせ: https://atelierns.com/pages/holiday
`;

type Product = {
  title: string;
  handle: string;
  url: string;
};

async function searchProducts(query: string): Promise<Product[]> {
  try {
    const results: Product[] = [];
    let page = 1;
    const keywords = query.toLowerCase().replace(/\s/g, '');

    while (page <= 10) {
      const res = await fetch(`https://atelierns.com/products.json?limit=250&page=${page}`);
      const data = await res.json();
      if (!data.products || data.products.length === 0) break;

      for (const p of data.products) {
        const title = p.title.toLowerCase().replace(/\s/g, '');
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

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    const products = await searchProducts(lastUserMessage);
    const productInfo = products.length > 0
      ? `\n【検索結果】以下の商品が見つかりました:\n` +
        products.map(p => `- ${p.title}: ${p.url}`).join('\n')
      : '\n【検索結果】該当する商品は見つかりませんでした。';

    const systemPrompt = `あなたはアトリエエヌズ（ATELIER N'S）の公式AIアシスタントです。
お客様のご質問に対して、丁寧で親切な日本語でお答えください。

${SITE_MAP}
${productInfo}

【回答ルール】
1. 商品が見つかった場合は、上記【検索結果】の正確なURLのみを使用してください。URLは絶対に推測や変更をしないでください
2. 回答の最後に以下のJSON形式でナビゲーション情報を含めてください：
   <!--NAV:{"label":"商品名","url":"https://atelierns.com/products/handle"}-->
3. 商品が見つからない場合はカテゴリーページへ案内し、お問い合わせも促してください
4. 回答はお客様に寄り添った温かい文章で、簡潔にまとめてください`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
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
