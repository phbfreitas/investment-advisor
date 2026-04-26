import * as https from 'https';
import * as http from 'http';
import * as cheerio from 'cheerio';
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

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECTS = 3;

function fetchText(url: string, redirectsRemaining: number = MAX_REDIRECTS): Promise<string> {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(
            url,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (compatible; InvestmentAdvisorBot/1.0)',
                },
                timeout: FETCH_TIMEOUT_MS,
            },
            (res) => {
                if (
                    res.statusCode &&
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location
                ) {
                    if (redirectsRemaining <= 0) {
                        reject(new Error(`Too many redirects for ${url}`));
                        return;
                    }
                    fetchText(res.headers.location, redirectsRemaining - 1).then(resolve).catch(reject);
                    return;
                }
                if (!res.statusCode || res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                    return;
                }
                const chunks: Buffer[] = [];
                let totalBytes = 0;
                let aborted = false;
                res.on('data', (chunk: Buffer) => {
                    if (aborted) return;
                    totalBytes += chunk.length;
                    if (totalBytes > MAX_RESPONSE_BYTES) {
                        aborted = true;
                        req.destroy();
                        reject(new Error(`Response exceeds ${MAX_RESPONSE_BYTES} bytes for ${url}`));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    if (!aborted) resolve(Buffer.concat(chunks).toString('utf-8'));
                });
                res.on('error', reject);
            }
        );
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout (${FETCH_TIMEOUT_MS}ms) for ${url}`));
        });
        req.on('error', reject);
    });
}

// ── Sitemap-based URL discovery ────────────────────────────────────────────
// Note: moneyguy.com's WordPress RSS feed (/feed/) returns an empty channel
// (0 items), so we discover content via their sitemap index instead.

const SITEMAP_URLS = [
    'https://moneyguy.com/article-sitemap.xml',
    'https://moneyguy.com/episode-sitemap.xml',
];

interface SitemapEntry {
    url: string;
    lastmod: string;
}

function parseSitemapEntries(xml: string): SitemapEntry[] {
    const entries: SitemapEntry[] = [];
    const urlRegex = /<url>[\s\S]*?<loc>([^<]+)<\/loc>(?:[\s\S]*?<lastmod>([^<]+)<\/lastmod>)?[\s\S]*?<\/url>/g;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(xml)) !== null) {
        entries.push({ url: match[1].trim(), lastmod: (match[2] ?? '').trim() });
    }
    return entries;
}

async function fetchLatestUrls(maxItems: number = 30): Promise<string[]> {
    const allEntries: SitemapEntry[] = [];

    for (const sitemapUrl of SITEMAP_URLS) {
        try {
            const xml = await fetchText(sitemapUrl);
            const entries = parseSitemapEntries(xml);
            console.log(`[Sitemap] ${sitemapUrl}: ${entries.length} URLs`);
            allEntries.push(...entries);
        } catch (err) {
            console.warn(`[Sitemap] Failed to fetch ${sitemapUrl}: ${String(err)}`);
        }
    }

    if (allEntries.length === 0) {
        throw new Error('No URLs found across any sitemap');
    }

    // Sort by lastmod descending (newest first); empty lastmod sorts last
    allEntries.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
    const top = allEntries.slice(0, maxItems);
    console.log(`[Sitemap] Selected top ${top.length} URLs (newest first)`);
    return top.map((e) => e.url);
}

// ── HTML → plain text (cheerio) ────────────────────────────────────────────

function extractTextFromHtml(html: string): { title: string; text: string } {
    const $ = cheerio.load(html);

    // Remove noise elements
    $("script, style, nav, header, footer, aside, .sidebar, .ads, .comments").remove();

    // Try to find the main article content
    const contentSelectors = ["article", ".entry-content", ".post-content", "main", "body"];
    let text = "";
    for (const selector of contentSelectors) {
        const el = $(selector).first();
        if (el.length && el.text().trim().length > 200) {
            text = el.text();
            break;
        }
    }
    if (!text) text = $("body").text();

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled";

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
    status: 'success' | 'error' | 'pending' | 'refreshing';
    startedAt?: string;
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

    if (fields.startedAt !== undefined) {
        expressionParts.push('#startedAt = :startedAt');
        names['#startedAt'] = 'startedAt';
        values[':startedAt'] = { S: fields.startedAt };
    }

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

interface RefreshEvent {
    force?: boolean;
}

export const handler = async (event?: RefreshEvent): Promise<void> => {
    console.log('[MoneyGuy] Refresh Lambda started.');

    const force = event?.force === true;
    if (force) {
        console.log('[MoneyGuy] force=true received — bypassing frequency gate.');
    }

    // 1. FREQUENCY GATE (skipped on manual trigger)
    if (!force) {
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
    }

    console.log('[MoneyGuy] Proceeding with refresh.');

    // 1b. ACQUIRE LOCK (conditional write — prevents concurrent runs;
    //     stale lock from a crashed run is taken over after STALE_LOCK_MS)
    const lockAcquired = await acquireRefreshLock();
    if (!lockAcquired) {
        console.log('[MoneyGuy] Another refresh is already in progress (lock held). Skipping.');
        return;
    }
    console.log('[MoneyGuy] Lock acquired, status set to "refreshing".');

    // Wrap remaining work in try/catch so any uncaught error transitions
    // the row out of "refreshing" instead of leaving the UI stuck on a spinner.
    try {
        await runRefreshPipeline();
    } catch (err) {
        console.error(`[MoneyGuy] Uncaught error during refresh: ${String(err)}`);
        try {
            await updateConfigRow({ status: 'error', updatedAt: new Date().toISOString() });
        } catch (dbErr) {
            console.error(`[DynamoDB] Failed to write error status after uncaught error: ${String(dbErr)}`);
        }
    }
};

const STALE_LOCK_MS = 10 * 60 * 1000;

async function acquireRefreshLock(): Promise<boolean> {
    const now = new Date().toISOString();
    const staleCutoff = new Date(Date.now() - STALE_LOCK_MS).toISOString();
    try {
        await dynamo.send(
            new UpdateItemCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: { S: 'SYSTEM#CONFIG' },
                    SK: { S: 'PERSONA_REFRESH#moneyguy' },
                },
                UpdateExpression: 'SET #status = :refreshing, #startedAt = :now, #updatedAt = :now',
                ConditionExpression:
                    'attribute_not_exists(#status) OR #status <> :refreshing OR attribute_not_exists(#startedAt) OR #startedAt < :staleCutoff',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#startedAt': 'startedAt',
                    '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                    ':refreshing': { S: 'refreshing' },
                    ':now': { S: now },
                    ':staleCutoff': { S: staleCutoff },
                },
            })
        );
        return true;
    } catch (err: unknown) {
        if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
            return false;
        }
        console.error(`[MoneyGuy] Failed to acquire lock: ${String(err)}`);
        return false;
    }
}

async function runRefreshPipeline(): Promise<void> {
    // 2. DISCOVER ARTICLE URLs (via sitemap)
    let articleUrls: string[];
    try {
        articleUrls = await fetchLatestUrls(30);
        console.log(`[Sitemap] Found ${articleUrls.length} URLs.`);
    } catch (err) {
        console.error(`[Sitemap] Failed to discover URLs: ${String(err)}`);
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

    // 5b. EMPTY-INDEX GUARD — if we ended up with no usable chunks (every scrape
    //     failed, every embed failed, etc.), report this as an error rather than
    //     silently overwriting S3 with [] and writing status=success.
    if (chunks.length === 0) {
        console.error(
            `[MoneyGuy] Refresh produced 0 usable chunks ` +
                `(urls=${articleUrls.length}, scraped=${articles.length}, rawChunks=${rawChunks.length}, embedded=${chunks.length}). ` +
                `Marking status=error; existing S3 index preserved.`
        );
        try {
            await updateConfigRow({ status: 'error', updatedAt: new Date().toISOString() });
        } catch (dbErr) {
            console.error(`[DynamoDB] Failed to update status to error: ${String(dbErr)}`);
        }
        return;
    }

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
}
