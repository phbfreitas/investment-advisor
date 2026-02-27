import * as fs from 'fs/promises';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

export interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        year: number;
        source: string;
    };
    embedding: number[];
}

let cachedBuffettIndex: DocumentChunk[] | null = null;

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

export async function getRagContext(personaId: string, query: string, topK: number = 3): Promise<string> {
    if (personaId !== 'buffett') return ""; // Only Buffett has RAG for now

    try {
        if (!cachedBuffettIndex) {
            const indexPath = path.join(process.cwd(), "data", "personas", "buffett-index.json");
            const fileData = await fs.readFile(indexPath, 'utf-8');
            cachedBuffettIndex = JSON.parse(fileData);
        }

        if (!cachedBuffettIndex) return "";

        const queryEmbeddingResult = await embeddingModel.embedContent(query);
        const queryEmbedding = queryEmbeddingResult.embedding.values;

        // Calculate similarities
        const scoredChunks = cachedBuffettIndex.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Sort by highest score
        scoredChunks.sort((a, b) => b.score - a.score);

        const topChunks = scoredChunks.slice(0, topK);

        // Format the retrieved context
        let contextString = "\n### RETRIEVED KNOWLEDGE BASE EXTRACTS:\n";
        contextString += "These are specific, retrieved excerpts from your actual writings meant to help you directly answer the user's question.\n\n";

        topChunks.forEach((chunk, index) => {
            contextString += `--- Extract ${index + 1} (Source: ${chunk.metadata.year} Shareholder Letter) ---\n`;
            contextString += `${chunk.text}\n\n`;
        });

        return contextString;
    } catch (e) {
        console.error(`Error retrieving RAG context for ${personaId}:`, e);
        return ""; // Silently fail and return no context if something goes wrong
    }
}
