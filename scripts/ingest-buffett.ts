import * as fs from "fs/promises";
import * as path from "path";
import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables. Please check your .env.local file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Include classic HTML letters and modern PDF letters
const LETTERS_TO_SCRAPE = [
    { year: 1977, url: "https://www.berkshirehathaway.com/letters/1977.html" },
    { year: 1989, url: "https://www.berkshirehathaway.com/letters/1989.html" },
    { year: 1995, url: "https://www.berkshirehathaway.com/letters/1995.html" },
    { year: 2018, url: "https://www.berkshirehathaway.com/letters/2018ltr.pdf" },
    { year: 2021, url: "https://www.berkshirehathaway.com/letters/2021ltr.pdf" },
    { year: 2022, url: "https://www.berkshirehathaway.com/letters/2022ltr.pdf" },
    { year: 2023, url: "https://www.berkshirehathaway.com/letters/2023ltr.pdf" },
];

const OUTPUT_DIR = path.join(process.cwd(), "data", "personas");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "buffett-index.json");

interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        year: number;
        source: string;
    };
    embedding?: number[];
}

async function fetchAndParseLetter(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    if (url.endsWith(".pdf")) {
        const buffer = await response.arrayBuffer();
        const parser = new PDFParse({ data: Buffer.from(buffer) });
        const result = await parser.getText();
        let text = result.text;
        text = text.replace(/\s+/g, " ").trim();
        await parser.destroy();
        return text;
    } else {
        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style").remove();
        let text = $("body").text();
        text = text.replace(/\s+/g, " ").trim();
        return text;
    }
}

function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + maxChunkSize;
        if (endIndex < text.length) {
            let lastPeriod = text.lastIndexOf(". ", endIndex);
            if (lastPeriod > startIndex + maxChunkSize / 2) {
                endIndex = lastPeriod + 1;
            }
        }
        chunks.push(text.slice(startIndex, endIndex).trim());
        startIndex = endIndex - overlap;
    }

    return chunks;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchEmbeddingWithRetry(text: string, retries = 5, delay = 5000): Promise<number[] | null> {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error: any) {
            const isRateLimit = error.status === 429 || (error.message && error.message.includes("429"));
            if (isRateLimit) {
                console.log(`\nRate limit hit. Waiting ${delay / 1000} seconds before retry ${i + 1}/${retries}...`);
                await sleep(delay);
                delay *= 2; // exponential backoff
            } else {
                console.error(`\nFailed to embed chunk:`, error.message);
                return null;
            }
        }
    }
    console.error(`\nMax retries reached for chunk.`);
    return null;
}

async function main() {
    console.log("Creating output directory...");
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    let allChunks: DocumentChunk[] = [];

    // 1. Scrape and Parse
    for (const letter of LETTERS_TO_SCRAPE) {
        console.log(`\nFetching ${letter.year} letter from ${letter.url}...`);
        try {
            const rawText = await fetchAndParseLetter(letter.url);
            console.log(`Fetched ${rawText.length} characters. Chunking text...`);

            const textChunks = chunkText(rawText);
            console.log(`Created ${textChunks.length} chunks.`);

            textChunks.forEach((text, index) => {
                allChunks.push({
                    id: `buffett-${letter.year}-${index}`,
                    text,
                    metadata: {
                        year: letter.year,
                        source: letter.url
                    }
                });
            });
        } catch (error) {
            console.error(`Error processing letter ${letter.year}:\n`, error);
        }
    }

    console.log(`\nGenerating embeddings for ${allChunks.length} total chunks...`);

    // 2. Embed with Paid Tier Limits
    // The user is on a paid tier which typically permits a much higher RPM limit.
    // We execute them sequentially with dynamic exponential backoff safely without artificial delays.
    const finalChunks: DocumentChunk[] = [];
    let processedCount = 0;

    for (const chunk of allChunks) {
        const embedding = await fetchEmbeddingWithRetry(chunk.text);
        if (embedding) {
            finalChunks.push({ ...chunk, embedding });
        }
        processedCount++;
        process.stdout.write(`\rProcessed ${processedCount}/${allChunks.length} embeddings.`);

    }

    console.log("\n\nSaving generated vector store...");
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalChunks, null, 2), "utf-8");
    console.log(`\nSuccessfully saved ${finalChunks.length} vectorized chunks to ${OUTPUT_FILE}`);
}

main().catch(console.error);
