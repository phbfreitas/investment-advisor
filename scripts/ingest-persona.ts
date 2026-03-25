import * as fs from "fs/promises";
import * as path from "path";
import * as cheerio from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Check your .env.local file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const OUTPUT_DIR = path.join(process.cwd(), "data", "personas");
const SOURCES_FILE = path.join(OUTPUT_DIR, "sources.json");

interface SourceEntry {
    type: "url" | "file";
    path: string;
    label: string;
}

interface SourceManifest {
    [personaId: string]: { sources: SourceEntry[] };
}

interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        sourceLabel: string;
        source: string;
    };
    embedding?: number[];
}

async function fetchUrl(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

    if (url.endsWith(".pdf")) {
        const buffer = await response.arrayBuffer();
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        return (text as string).replace(/\s+/g, " ").trim();
    } else {
        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style").remove();
        return $("body").text().replace(/\s+/g, " ").trim();
    }
}

async function readLocalPdf(filePath: string): Promise<string> {
    const absolutePath = path.join(process.cwd(), filePath);
    const buffer = await fs.readFile(absolutePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return (text as string).replace(/\s+/g, " ").trim();
}

function chunkText(text: string, maxChunkSize: number = 1000): string[] {
    let paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    if (paragraphs.length <= 1 && text.length > maxChunkSize) {
        paragraphs = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(p => p.trim().length > 0);
    }

    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed) continue;

        if (currentChunk && (currentChunk.length + trimmed.length + 1) > maxChunkSize) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }

        if (trimmed.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            chunks.push(trimmed);
        } else {
            currentChunk += (currentChunk ? " " : "") + trimmed;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchEmbeddingWithRetry(text: string, retries = 5, delay = 5000): Promise<number[] | null> {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            const e = error as { status?: number; message?: string };
            const isRateLimit = e.status === 429 || (e.message && e.message.includes("429"));
            if (isRateLimit) {
                console.log(`\nRate limit hit. Waiting ${delay / 1000}s before retry ${i + 1}/${retries}...`);
                await sleep(delay);
                delay *= 2;
            } else {
                console.error(`\nFailed to embed chunk:`, e.message);
                return null;
            }
        }
    }
    console.error(`\nMax retries reached for chunk.`);
    return null;
}

async function ingestPersona(personaId: string, sources: SourceEntry[]) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Ingesting persona: ${personaId} (${sources.length} source(s))`);
    console.log(`${"=".repeat(60)}`);

    const allChunks: DocumentChunk[] = [];

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
        const source = sources[sourceIdx];
        console.log(`\n[${sourceIdx + 1}/${sources.length}] Processing: ${source.label}`);

        try {
            let rawText: string;
            if (source.type === "url") {
                console.log(`  Fetching URL: ${source.path}`);
                rawText = await fetchUrl(source.path);
            } else {
                console.log(`  Reading file: ${source.path}`);
                rawText = await readLocalPdf(source.path);
            }

            console.log(`  Extracted ${rawText.length} characters. Chunking...`);
            const textChunks = chunkText(rawText);
            console.log(`  Created ${textChunks.length} chunks.`);

            textChunks.forEach((text, chunkIdx) => {
                allChunks.push({
                    id: `${personaId}-${sourceIdx}-${chunkIdx}`,
                    text,
                    metadata: {
                        sourceLabel: source.label,
                        source: source.path,
                    },
                });
            });
        } catch (error) {
            console.error(`  Error processing source "${source.label}":`, error);
        }
    }

    console.log(`\nGenerating embeddings for ${allChunks.length} chunks...`);

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

    const outputFile = path.join(OUTPUT_DIR, `${personaId}-index.json`);
    await fs.writeFile(outputFile, JSON.stringify(finalChunks), "utf-8");
    console.log(`\n\nSaved ${finalChunks.length} vectorized chunks to ${outputFile}`);
}

async function main() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const manifestData = await fs.readFile(SOURCES_FILE, "utf-8");
    const manifest: SourceManifest = JSON.parse(manifestData);

    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error("Usage: npx tsx scripts/ingest-persona.ts <personaId> | --all");
        process.exit(1);
    }

    if (args[0] === "--all") {
        for (const personaId of Object.keys(manifest)) {
            await ingestPersona(personaId, manifest[personaId].sources);
        }
    } else {
        const personaId = args[0];
        if (!manifest[personaId]) {
            console.error(`Persona "${personaId}" not found in sources.json. Available: ${Object.keys(manifest).join(", ")}`);
            process.exit(1);
        }
        await ingestPersona(personaId, manifest[personaId].sources);
    }

    console.log("\n\nIngestion complete!");
}

main().catch(console.error);
