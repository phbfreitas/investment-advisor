import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export interface NewsArticle {
    title: string;
    description: string;
    pubDate: string;
    source: string;
    category: string[];
    link: string;
}

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || "";

/**
 * Fetches financial news from NewsData.io API.
 */
async function fetchFinancialNews(): Promise<NewsArticle[]> {
    if (!NEWSDATA_API_KEY) {
        throw new Error("NEWSDATA_API_KEY is not set in environment variables.");
    }

    const query = "interest rates OR inflation OR energy OR commodities OR geopolitical OR markets OR federal reserve OR tariffs";
    const url = `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_API_KEY}&language=en&category=business&q=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text();
        console.error("NewsData.io API error:", res.status, text.substring(0, 200));
        throw new Error(`NewsData.io API returned status ${res.status}`);
    }

    const data = await res.json();

    if (!data.results || !Array.isArray(data.results)) {
        return [];
    }

    return data.results.map((item: Record<string, unknown>) => ({
        title: item.title || "",
        description: item.description || "",
        pubDate: item.pubDate || "",
        source: (item.source_id as string) || "",
        category: Array.isArray(item.category) ? item.category : [],
        link: item.link || "",
    }));
}

/**
 * Returns cached news for today, or fetches fresh from NewsData.io.
 * Uses a GLOBAL cache key (shared across all households) to conserve API quota.
 */
export async function getCachedOrFreshNews(): Promise<{ articles: NewsArticle[]; newsDate: string }> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const cacheKey = { PK: "GLOBAL", SK: `NEWS_CACHE#${today}` };

    // Check cache
    const { Item: cached } = await db.send(
        new GetCommand({ TableName: TABLE_NAME, Key: cacheKey })
    );

    if (cached && Array.isArray(cached.articles)) {
        return { articles: cached.articles as NewsArticle[], newsDate: today };
    }

    // Fetch fresh
    try {
        const articles = await fetchFinancialNews();

        // Cache in DynamoDB
        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    ...cacheKey,
                    articles,
                    entityType: "NEWS_CACHE",
                    fetchedAt: new Date().toISOString(),
                },
            })
        );

        return { articles, newsDate: today };
    } catch (error) {
        console.error("Failed to fetch news:", error);
        // Return empty on failure — AI will work with its training knowledge
        return { articles: [], newsDate: today };
    }
}

/**
 * Formats news articles into a context string for AI prompt injection.
 */
export function formatNewsContext(articles: NewsArticle[]): string {
    if (articles.length === 0) {
        return "No recent financial news available. Analyze based on your knowledge of current macro trends and the user's portfolio context.";
    }

    const lines = articles.slice(0, 15).map((a, i) => {
        const desc = a.description ? ` — ${a.description.substring(0, 200)}` : "";
        return `${i + 1}. [${a.source}] ${a.title}${desc}`;
    });

    return `Recent Financial & Geopolitical News (${articles[0]?.pubDate?.split(" ")[0] || "today"}):\n${lines.join("\n")}`;
}
