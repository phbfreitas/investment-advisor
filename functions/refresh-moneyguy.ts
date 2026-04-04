import * as https from 'https';
import * as http from 'http';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Types ──────────────────────────────────────────────────────────────────

interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        sourceLabel: string;
        source: string;
    };
    embedding: number[];
}

interface ScrapedArticle {
    url: string;
    title: string;
    text: string;
}

// ── AWS / AI clients ───────────────────────────────────────────────────────

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME ?? 'InvestmentAdvisorData';
const BUCKET = process.env.DYNAMIC_RAG_BUCKET ?? '';
const S3_KEY = 'moneyguy-dynamic-index.json';

const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

// ── HTTP helper ────────────────────────────────────────────────────────────

function fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib.get(
            url,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (compatible; InvestmentAdvisorBot/1.0)',
                },
            },
            (res) => {
                if (
                    res.statusCode &&
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location
                ) {
                    // Follow a single redirect
                    fetchText(res.headers.location).then(resolve).catch(reject);
                    return;
                }
                if (!res.statusCode || res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                    return;
                }
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
                res.on('error', reject);
            }
        ).on('error', reject);
    });
}

// ── RSS parsing ────────────────────────────────────────────────────────────

function parseLinksFromRss(xml: string): string[] {
    const links: string[] = [];
    // Match <item> blocks and extract the <link> inside each
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemContent = itemMatch[1];
        // <link> may contain CDATA or plain URL; look for the first URL-like content
        const linkMatch =
            itemContent.match(/<link>(?:<!\[CDATA\[)?(https?:\/\/[^<\]]+?)(?:\]\]>)?<\/link>/i) ??
            itemContent.match(/<link\s*\/>(https?:\/\/[^\s<]+)/i);
        if (linkMatch) {
            links.push(linkMatch[1].trim());
        }
    }
    return links;
}

async function fetchRssLinks(maxItems: number = 30): Promise<string[]> {
    const baseUrl = 'https://www.moneyguy.com/feed/';
    let links: string[] = [];

    for (let page = 1; page <= 3 && links.length < maxItems; page++) {
        const url = page === 1 ? baseUrl : `${baseUrl}?paged=${page}`;
        try {
            const xml = await fetchText(url);
            const pageLinks = parseLinksFromRss(xml);
            if (pageLinks.length === 0) break; // No more pages
            links = links.concat(pageLinks);
        } catch (err) {
            if (page === 1) {
                // First page failure is fatal for RSS step
                throw err;
            }
            // Subsequent page failures — stop paging
            console.warn(`[RSS] Failed to fetch page ${page}: ${String(err)}`);
            break;
        }
    }

    return links.slice(0, maxItems);
}

// ── HTML → plain text ──────────────────────────────────────────────────────

function extractTextFromHtml(html: string): { title: string; text: string } {
    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].replace(/&#\d+;/g, '').trim() : 'Untitled';
    // Decode common HTML entities in title
    title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // Remove script / style / nav / header / footer / aside blocks
    let body = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '');

    // Try to isolate the article body (common class names used by Money Guy / WordPress)
    const articleMatch =
        body.match(/<article[\s\S]*?<\/article>/i) ??
        body.match(/class="[^"]*(?:entry-content|post-content|article-content)[^"]*"[\s\S]*?<\/div>/i);
    if (articleMatch) {
        body = articleMatch[0];
    }

    // Strip remaining HTML tags
    const text = body
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/(\. |\? |! )/g, '$1\n')
        .trim();

    return { title, text };
}

// ── Text chunking ──────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000;

function chunkText(text: string): string[] {
    const chunks: string[] = [];
    // First split on double newlines (paragraph boundaries)
    const paragraphs = text.split(/\n\n+/);
    let current = '';

    for (const para of paragraphs) {
        if ((current + '\n\n' + para).length <= CHUNK_SIZE) {
            current = current ? current + '\n\n' + para : para;
        } else {
            // Paragraph itself may exceed chunk size — split on sentence endings
            const sentences = para.split(/(?<=[.?!])\s+/);
            for (const sentence of sentences) {
                if ((current + ' ' + sentence).length <= CHUNK_SIZE) {
                    current = current ? current + ' ' + sentence : sentence;
                } else {
                    if (current) chunks.push(current.trim());
                    // Sentence longer than chunk size — hard split
                    if (sentence.length > CHUNK_SIZE) {
                        for (let i = 0; i < sentence.length; i += CHUNK_SIZE) {
                            chunks.push(sentence.slice(i, i + CHUNK_SIZE).trim());
                        }
                        current = '';
                    } else {
                        current = sentence;
                    }
                }
            }
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter((c) => c.length > 0);
}

// ── Gemini embedding with exponential backoff ──────────────────────────────

async function embedWithBackoff(text: string): Promise<number[] | null> {
    const BASE_DELAY_MS = 5000;
    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (err: unknown) {
            const errMsg = String(err);
            const is429 =
                errMsg.includes('429') ||
                errMsg.toLowerCase().includes('rate') ||
                errMsg.toLowerCase().includes('quota');

            if (is429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(
                    `[Embed] Rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
                );
                await new Promise((r) => setTimeout(r, delay));
            } else {
                if (attempt === MAX_RETRIES) {
                    console.warn(`[Embed] Max retries exceeded for chunk. Skipping.`);
                } else {
                    console.warn(`[Embed] Non-retryable error: ${errMsg}. Skipping chunk.`);
                }
                return null;
            }
        }
    }
    return null;
}

// ── DynamoDB helpers ───────────────────────────────────────────────────────

async function readConfigRow(): Promise<{
    frequencyDays: number;
    lastRefreshedAt: string | null;
} | null> {
    const result = await dynamo.send(
        new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: { S: 'SYSTEM#CONFIG' },
                SK: { S: 'PERSONA_REFRESH#moneyguy' },
            },
        })
    );

    if (!result.Item) return null;

    const frequencyDays =
        result.Item.frequencyDays?.N != null
            ? Number(result.Item.frequencyDays.N)
            : 7;

    const lastRefreshedAt = result.Item.lastRefreshedAt?.S ?? null;

    return { frequencyDays, lastRefreshedAt };
}

async function updateConfigRow(fields: {
    status: 'success' | 'error' | 'pending';
    lastRefreshedAt?: string;
    articleCount?: number;
    updatedAt: string;
}): Promise<void> {
    const expressionParts: string[] = [
        '#status = :status',
        '#updatedAt = :updatedAt',
    ];
    const names: Record<string, string> = {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
    };
    const values: Record<string, { S: string } | { N: string }> = {
        ':status': { S: fields.status },
        ':updatedAt': { S: fields.updatedAt },
    };

    if (fields.lastRefreshedAt !== undefined) {
        expressionParts.push('#lastRefreshedAt = :lastRefreshedAt');
        names['#lastRefreshedAt'] = 'lastRefreshedAt';
        values[':lastRefreshedAt'] = { S: fields.lastRefreshedAt };
    }

    if (fields.articleCount !== undefined) {
        expressionParts.push('#articleCount = :articleCount');
        names['#articleCount'] = 'articleCount';
        values[':articleCount'] = { N: String(fields.articleCount) };
    }

    await dynamo.send(
        new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: { S: 'SYSTEM#CONFIG' },
                SK: { S: 'PERSONA_REFRESH#moneyguy' },
            },
            UpdateExpression: `SET ${expressionParts.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
        })
    );
}

// ── Main handler ───────────────────────────────────────────────────────────

export const handler = async (): Promise<void> => {
    console.log('[MoneyGuy] Refresh Lambda started.');

    // 1. FREQUENCY GATE
    let configRow: { frequencyDays: number; lastRefreshedAt: string | null } | null = null;
    try {
        configRow = await readConfigRow();
    } catch (err) {
        console.warn(`[MoneyGuy] Could not read config row (continuing): ${String(err)}`);
    }

    if (configRow?.lastRefreshedAt) {
        const frequencyMs = (configRow.frequencyDays ?? 7) * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(configRow.lastRefreshedAt).getTime();
        if (elapsed < frequencyMs) {
            console.log(
                `[MoneyGuy] Skipping refresh — last run was ${Math.round(elapsed / 3600000)}h ago, ` +
                    `frequency is ${configRow.frequencyDays ?? 7} days.`
            );
            return;
        }
    }

    console.log('[MoneyGuy] Proceeding with refresh.');

    // 2. FETCH RSS
    let articleUrls: string[];
    try {
        articleUrls = await fetchRssLinks(30);
        console.log(`[RSS] Found ${articleUrls.length} article URLs.`);
    } catch (err) {
        console.error(`[RSS] Failed to fetch RSS feed: ${String(err)}`);
        try {
            await updateConfigRow({ status: 'error', updatedAt: new Date().toISOString() });
        } catch (dbErr) {
            console.error(`[DynamoDB] Failed to update status to error: ${String(dbErr)}`);
        }
        return;
    }

    // 3. SCRAPE ARTICLES
    const articles: ScrapedArticle[] = [];
    for (const url of articleUrls) {
        try {
            const html = await fetchText(url);
            const { title, text } = extractTextFromHtml(html);
            if (text.length < 100) {
                console.warn(`[Scrape] Skipping ${url} — extracted text too short (${text.length} chars).`);
                continue;
            }
            articles.push({ url, title, text });
            console.log(`[Scrape] OK: "${title}" (${text.length} chars)`);
        } catch (err) {
            console.warn(`[Scrape] Failed for ${url}: ${String(err)}`);
        }
    }
    console.log(`[Scrape] Successfully scraped ${articles.length} articles.`);

    // 4. CHUNK TEXT
    const rawChunks: Array<{ id: string; text: string; metadata: { sourceLabel: string; source: string } }> = [];
    for (let ai = 0; ai < articles.length; ai++) {
        const { url, title, text } = articles[ai];
        const textChunks = chunkText(text);
        for (let ci = 0; ci < textChunks.length; ci++) {
            rawChunks.push({
                id: `moneyguy-article-${ai}-${ci}`,
                text: textChunks[ci],
                metadata: { sourceLabel: title, source: url },
            });
        }
    }
    console.log(`[Chunk] Created ${rawChunks.length} chunks from ${articles.length} articles.`);

    // 5. EMBED
    const chunks: DocumentChunk[] = [];
    for (const raw of rawChunks) {
        const embedding = await embedWithBackoff(raw.text);
        if (embedding === null) continue; // logged inside embedWithBackoff
        chunks.push({ ...raw, embedding });
    }
    console.log(`[Embed] Embedded ${chunks.length}/${rawChunks.length} chunks successfully.`);

    // 6. WRITE TO S3
    try {
        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: S3_KEY,
                Body: JSON.stringify(chunks),
                ContentType: 'application/json',
            })
        );
        console.log(`[S3] Wrote ${chunks.length} chunks to s3://${BUCKET}/${S3_KEY}`);
    } catch (err) {
        console.error(`[S3] Failed to write index: ${String(err)}`);
        // S3 failure is logged but we still update DynamoDB with partial success indicator
        try {
            await updateConfigRow({ status: 'error', updatedAt: new Date().toISOString() });
        } catch (dbErr) {
            console.error(`[DynamoDB] Failed to update status after S3 error: ${String(dbErr)}`);
        }
        return;
    }

    // 7. UPDATE DYNAMODB
    const now = new Date().toISOString();
    try {
        await updateConfigRow({
            status: 'success',
            lastRefreshedAt: now,
            articleCount: articles.length,
            updatedAt: now,
        });
        console.log(`[DynamoDB] Config row updated — articleCount=${articles.length}, status=success.`);
    } catch (err) {
        console.error(`[DynamoDB] Failed to update config row after success: ${String(err)}`);
    }

    console.log('[MoneyGuy] Refresh complete.');
};
