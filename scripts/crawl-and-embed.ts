/**
 * scripts/crawl-and-embed.ts
 * atelierns.com 全ページをクロールして Supabase (pgvector) に保存するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/crawl-and-embed.ts
 *
 * 事前に .env.local に以下を設定してください:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// --- 環境変数の読み込み (.env.local) ---
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local が見つかりません');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('環境変数 SUPABASE_URL / SUPABASE_SERVICE_KEY / OPENAI_API_KEY が未設定です');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const TARGET_SITE = 'https://atelierns.com';
const SITEMAP_URL = 'https://atelierns.com/sitemap.xml';
const CRAWL_DELAY_MS = 1000;
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

const ALLOWED_PATH_PATTERNS = [
  /^\/pages\//,
  /^\/products\//,
  /^\/collections\//,
  /^\/policies\//,
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSitemapUrls(): Promise<string[]> {
  console.log('sitemap.xml を取得中...');
  const res = await fetch(SITEMAP_URL);
  const xml = await res.text();

  // sitemapindex か通常のsitemapかを判定
  const isSitemapIndex = xml.includes('<sitemapindex');

  if (isSitemapIndex) {
    // サブsitemapのURLを取得
    const subSitemapMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    const subSitemapUrls: string[] = [];
    for (const m of subSitemapMatches) {
      const url = m[1].trim();
      // 日本語（デフォルト）のsitemapのみ対象（zh, zh-tw, zh-cn は除外）
      if (!url.includes('/zh/') && !url.includes('/zh-tw/') && !url.includes('/zh-cn/')) {
        subSitemapUrls.push(url);
      }
    }
    console.log(`サブsitemap: ${subSitemapUrls.length} 件を検出`);

    // 各サブsitemapからURLを収集
    const allUrls: string[] = [];
    for (const subUrl of subSitemapUrls) {
      try {
        const subRes = await fetch(subUrl);
        const subXml = await subRes.text();
        const matches = subXml.matchAll(/<loc>([^<]+)<\/loc>/g);
        for (const m of matches) {
          allUrls.push(m[1].trim());
        }
        await sleep(300);
      } catch (e) {
        console.error(`サブsitemap取得エラー: ${subUrl}`);
      }
    }
    console.log(`sitemap から ${allUrls.length} 件の URL を取得`);
    return allUrls;
  } else {
    // 通常のsitemap
    const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    const urls: string[] = [];
    for (const m of matches) {
      urls.push(m[1].trim());
    }
    console.log(`sitemap から ${urls.length} 件の URL を取得`);
    return urls;
  }
}

async function fetchDisallowedPaths(): Promise<RegExp[]> {
  try {
    const res = await fetch(`${TARGET_SITE}/robots.txt`);
    const text = await res.text();
    const disallowed: RegExp[] = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^Disallow:\s*(.+)/i);
      if (m) {
        const pattern = m[1].trim()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace('\\*', '.*');
        disallowed.push(new RegExp('^' + pattern));
      }
    }
    console.log(`robots.txt: ${disallowed.length} 件の Disallow を確認`);
    return disallowed;
  } catch {
    return [];
  }
}

function isAllowedUrl(url: string, disallowed: RegExp[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'atelierns.com') return false;
    const p = parsed.pathname;
    for (const re of disallowed) {
      if (re.test(p)) return false;
    }
    return ALLOWED_PATH_PATTERNS.some(re => re.test(p));
  } catch {
    return false;
  }
}

function extractText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#[0-9]+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { title, text: cleaned };
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks.filter(c => c.trim().length > 50);
}

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

async function saveChunk(
  url: string,
  title: string,
  content: string,
  embedding: number[]
) {
  const { error } = await supabase.from('documents').insert({
    url, title, content, embedding,
  });
  if (error) console.error(`  保存エラー: ${error.message}`);
}

async function main() {
  console.log('=== atelierns.com RAG クローラー 開始 ===\n');

  const disallowed = await fetchDisallowedPaths();
  const allUrls = await fetchSitemapUrls();
  const targetUrls = allUrls.filter(u => isAllowedUrl(u, disallowed));
  console.log(`クロール対象: ${targetUrls.length} 件\n`);

  const { data: existing } = await supabase
    .from('documents')
    .select('url');
  const existingUrls = new Set((existing || []).map((r: { url: string }) => r.url));

  let processed = 0; let skipped = 0; let errors = 0;

  for (let i = 0; i < targetUrls.length; i++) {
    const url = targetUrls[i];
    if (existingUrls.has(url)) { skipped++; continue; }

    try {
      console.log(`[${i + 1}/${targetUrls.length}] ${url}`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AtelierNS-RAG-Bot/1.0' },
      });

      if (!res.ok) {
        console.log(`  スキップ (HTTP ${res.status})`);
        skipped++;
        await sleep(CRAWL_DELAY_MS);
        continue;
      }

      const html = await res.text();
      const { title, text } = extractText(html);

      if (text.length < 100) {
        console.log('  スキップ (テキスト不足)');
        skipped++;
        await sleep(CRAWL_DELAY_MS);
        continue;
      }

      const chunks = chunkText(text);
      console.log(`  → ${chunks.length} チャンク`);

      for (const chunk of chunks) {
        const embedding = await embed(`${title}\n${chunk}`);
        await saveChunk(url, title, chunk, embedding);
      }
      processed++;
    } catch (err) {
      console.error(`  エラー: ${(err as Error).message}`);
      errors++;
    }

    await sleep(CRAWL_DELAY_MS);
  }

  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${processed} ページ`);
  console.log(`スキップ: ${skipped} ページ`);
  console.log(`エラー: ${errors} ページ`);
}

main().catch(console.error);
