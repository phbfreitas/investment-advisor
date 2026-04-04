import * as fs from 'fs/promises';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchS3Json } from './s3';
import { personas } from './personas-data';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

export interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        sourceLabel: string;
        source: string;
    };
    embedding: number[];
}

const cachedIndexes: Map<string, DocumentChunk[]> = new Map();

const DYNAMIC_INDEX_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface DynamicIndexCache {
    chunks: DocumentChunk[];
    loadedAt: number;
}

const cachedDynamicIndexes: Map<string, DynamicIndexCache> = new Map();

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const RELEVANCE_THRESHOLD = 0.30;
const MAX_CONTEXT_TOKENS = 2000;

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

async function loadDynamicIndex(personaId: string, s3Key: string): Promise<DocumentChunk[]> {
    const bucket = process.env.DYNAMIC_RAG_BUCKET || "";
    const cached = cachedDynamicIndexes.get(personaId);

    // Return cached data if still fresh
    if (cached && (Date.now() - cached.loadedAt) < DYNAMIC_INDEX_TTL_MS) {
        return cached.chunks;
    }

    // Fetch from S3
    const chunks = await fetchS3Json<DocumentChunk[]>(bucket, s3Key);

    if (chunks && chunks.length > 0) {
        cachedDynamicIndexes.set(personaId, { chunks, loadedAt: Date.now() });
        console.log(`[RAG:${personaId}] Loaded ${chunks.length} dynamic chunks from S3.`);
        return chunks;
    }

    // S3 empty or failed — return stale cache if available, else empty
    if (cached) {
        console.log(`[RAG:${personaId}] S3 fetch returned empty — using stale dynamic cache (${cached.chunks.length} chunks).`);
        return cached.chunks;
    }

    console.log(`[RAG:${personaId}] No dynamic index available yet (S3 empty before first refresh).`);
    return [];
}

export async function getRagContext(personaId: string, query: string, topK: number = 3): Promise<string> {
    try {
        if (!cachedIndexes.has(personaId)) {
            const indexPath = path.join(process.cwd(), "data", "personas", `${personaId}-index.json`);
            try {
                const fileData = await fs.readFile(indexPath, 'utf-8');
                cachedIndexes.set(personaId, JSON.parse(fileData));
            } catch {
                // Index file doesn't exist — persona works without RAG
                console.log(`[RAG] No index file found for persona "${personaId}". Skipping RAG context.`);
                return "";
            }
        }

        const staticIndex = cachedIndexes.get(personaId) ?? [];

        // Merge dynamic index for personas that support it
        const persona = personas[personaId as keyof typeof personas];
        let allChunks: DocumentChunk[];
        if (persona?.hasDynamicRag && persona.dynamicRagS3Key) {
            const dynamicChunks = await loadDynamicIndex(personaId, persona.dynamicRagS3Key);
            allChunks = [...staticIndex, ...dynamicChunks];
            console.log(`[RAG:${personaId}] Composite index: ${staticIndex.length} static + ${dynamicChunks.length} dynamic chunks.`);
        } else {
            allChunks = staticIndex;
        }

        if (allChunks.length === 0) return "";

        const queryEmbeddingResult = await embeddingModel.embedContent(query);
        const queryEmbedding = queryEmbeddingResult.embedding.values;

        // Calculate similarities
        const scoredChunks = allChunks.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Sort by highest score
        scoredChunks.sort((a, b) => b.score - a.score);

        // Log top scores for debugging
        const topScores = scoredChunks.slice(0, topK).map(c => ({
            id: c.id,
            score: c.score.toFixed(4),
            source: c.metadata.sourceLabel,
        }));
        console.log(`[RAG:${personaId}] Query: "${query.slice(0, 80)}..." | Top scores:`, topScores);

        // Filter by relevance threshold
        const relevantChunks = scoredChunks
            .slice(0, topK)
            .filter(chunk => chunk.score >= RELEVANCE_THRESHOLD);

        if (relevantChunks.length === 0) {
            console.log(`[RAG:${personaId}] No chunks passed relevance threshold (${RELEVANCE_THRESHOLD}). Skipping RAG context.`);
            return "";
        }

        // Apply token budget — include as many chunks as fit
        let contextString = "\n### RETRIEVED KNOWLEDGE BASE EXTRACTS:\n";
        contextString += "These are specific, retrieved excerpts from your actual writings meant to help you directly answer the user's question.\n\n";

        const headerTokens = estimateTokens(contextString);
        let usedTokens = headerTokens;
        let includedCount = 0;

        for (const chunk of relevantChunks) {
            const chunkText = `--- Extract ${includedCount + 1} (Source: ${chunk.metadata.sourceLabel}) ---\n${chunk.text}\n\n`;
            const chunkTokens = estimateTokens(chunkText);

            if (usedTokens + chunkTokens > MAX_CONTEXT_TOKENS && includedCount > 0) {
                console.log(`[RAG:${personaId}] Token budget reached (${usedTokens}/${MAX_CONTEXT_TOKENS}). Included ${includedCount}/${relevantChunks.length} relevant chunks.`);
                break;
            }

            contextString += chunkText;
            usedTokens += chunkTokens;
            includedCount++;
        }

        console.log(`[RAG:${personaId}] Included ${includedCount} chunks (~${usedTokens} tokens).`);
        return contextString;
    } catch (e) {
        console.error(`Error retrieving RAG context for ${personaId}:`, e);
        return "";
    }
}
