import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, productContext, pageType } = await req.json();

  const pageContext: Record<string, string> = {
    product: "現在、お客様は商品ページをご覧です。",
    cart: "現在、お客様はカートページをご覧です。",
    index: "現在、お客様はトップページをご覧です。",
  };

  const systemPrompt = `あなたはATELIER N'Sのショップスタッフです。
丁寧で上品な日本語でお客様をご案内ください。
ブランドは高品質なアパレルを提供するプレミアムブランドです。
${pageContext[pageType] ?? ""}
${productContext ? `\n【現在の商品情報】\n${productContext}` : ""}

以下のルールを守ってください：
- 返品・返金に関する質問には {"action":"navigate","url":"/policies/refund-policy"} を含めてください
- 配送・送料に関する質問には {"action":"navigate","url":"/policies/shipping-policy"} を含めてください
- 店舗に関する質問には {"action":"navigate","url":"/pages/store"} を含めてください
- お問い合わせに関する質問には {"action":"navigate","url":"/pages/contact"} を含めてください
- 回答できない質問はメールアドレスをお聞きし「後ほどスタッフよりご連絡いたします」と伝えてください`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    system: systemPrompt,
    messages,
  });

  const message =
    response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ message });
}
