import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: 'あなたはアトリエエヌズのAIアシスタントです。丁寧で親切な日本語で回答してください。',
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
