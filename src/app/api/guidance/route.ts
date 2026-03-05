import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Extend AWS/Vercel timeout limit to 60s

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(request: Request) {
    if (!apiKey) {
        return NextResponse.json(
            { error: "GEMINI_API_KEY is not set in environment variables." },
            { status: 500 }
        );
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session || !(session.user as any)?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${(session.user as any).householdId}`;
        const { directiveId, ticker } = await request.json();

        if (!directiveId) {
            return NextResponse.json({ error: "Directive ID is required" }, { status: 400 });
        }

        // 1. Fetch User Context
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        const { Items: assets } = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: {
                    ":pk": PROFILE_KEY,
                    ":skPrefix": "ASSET#",
                },
            })
        );

        // Build context string from profile and assets
        const assetsList = assets || [];
        const assetSummary = assetsList.length > 0
            ? assetsList.map(a => `- ${a.quantity} units of ${a.ticker} (Cost: $${a.bookCost}, Value: $${a.marketValue}, Yield: ${a.yield}%)`).join("\n")
            : "No assets documented.";

        const contextString = `
USER PORTFOLIO DATA:
Strategy: ${profile?.strategy || "Not specified"}
Risk Tolerance: ${profile?.riskTolerance || "Not specified"}
Goals: ${profile?.goals || "Not specified"}
Assets:
${assetSummary}
`;

        const formattingRules = `
FORMATTING RULES (CRITICAL):
- ALWAYS use GitHub-flavored Markdown.
- Break up large blocks of text. Use double newlines for generous spacing.
- Use H2 (\`##\`) and H3 (\`###\`) headers to clearly separate sections.
- Use bulleted lists (\`-\`) heavily for any multi-point analysis.
- **Bold** key terms, tickers, and financial metrics (e.g., **$150.00**, **AAPL**, **Overweight**).
- Use Blockquotes (\`>\`) to highlight the most important takeaway or conclusion.
- Where appropriate (especially for comparisons or multi-factor analysis), use Markdown Tables for scannability.
- Never write a paragraph longer than 3-4 sentences without breaking it up.
`;

        let prompt = "";
        switch (directiveId) {
            case 1:
                prompt = `Based on the following user portfolio, execute this directive: "Rebalance with Precision: Identify when my growth-to-income ratio drifts from the 50/50 target." Analyze the assets, estimate the growth vs income ratio, and provide a concise rebalancing action plan.
${formattingRules}
USER INFO & PORTFOLIO:\n${contextString}`;
                break;
            case 2:
                prompt = `Based on the following user portfolio, execute this directive: "Optimize Dividend Growth: Suggest high-conviction moves to increase dividend growth." Provide specific, strategic opportunities tailored to their holdings.
${formattingRules}
USER INFO & PORTFOLIO:\n${contextString}`;
                break;
            case 3:
                prompt = `Based on the following user portfolio, execute this directive: "Maintain Tactical Aggression: Highlight 'Buy the Dip' opportunities in the US and Canadian markets that align with my 10% annual return benchmark." Note: You do not have live data right now, but provide overarching strategic advice on where typical 'buy the dip' opportunities arise given their current asset class allocations.
${formattingRules}
USER INFO & PORTFOLIO:\n${contextString}`;
                break;
            case 4:
                prompt = `The user is interested in evaluating a new investment opportunity for ticker: **${ticker}**. 
Execute this directive: "Investment Idea Evaluation: For each new opportunity or asset, provide four response pillars."
Respond EXACTLY with these 4 Markdown Headings:
## 1. Board of Directors Opinion
(Simulate a brief round-table debate between Warren Buffett, Ray Dalio, Cathie Wood, Peter Lynch, and John Bogle regarding ${ticker}. Use a bulleted list for each person.)
## 2. Multi-Factor Analysis
(Evaluate Fundamental, Technical, and Portfolio fit. Use a Markdown Table to present this cleanly.)
## 3. Strategic Direction
(Explain how this idea fits into the user's specific long-term strategy and existing portfolio below. Use bullet points.)
## 4. AI Official Opinion
(A final, direct assessment and recommendation on the idea's viability.)

${formattingRules}
USER STRATEGY & PORTFOLIO:\n${contextString}`;
                break;
            case 5:
                prompt = `Based on the following user portfolio, execute this directive: "Portfolio Report: Produce a multi-factor portfolio analysis report highlighting strengths, weaknesses, and suggestions for changes, including recommendations on how to rebalance the portfolio." 
Break this into clear sections with H2 headers. Use a Markdown Table to lists Strengths vs Weaknesses side-by-side if possible, or distinct bulleted lists.
${formattingRules}
USER INFO & PORTFOLIO:\n${contextString}`;
                break;
            case 6:
                prompt = `Based on the following user portfolio, execute this directive: "Stock Recommendations: Based on the strategy, portfolio, and the opinions of experts, recommend specific stocks to buy assuming funds are available." 
Name 3-5 specific equities/ETFs with clear rationale. Present each recommendation clearly, using bold text for the Ticker and a bulleted list for the "Why".
${formattingRules}
USER INFO & PORTFOLIO:\n${contextString}`;
                break;
            default:
                return NextResponse.json({ error: "Invalid directive ID" }, { status: 400 });
        }

        // Call Gemini with streaming
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // Reverting to flash model to avoid AWS CloudFront 30s strict timeout limits
            systemInstruction: "You are an elite, highly intelligent Chief Investment Officer. Your communication style is immaculate, highly structured, and visually scannable. You abhor 'wall of text' responses. You structure every response utilizing Markdown headers, bullet points, bold text for emphasis on metrics, and tables where data is compared. Be crisp, professional, and actionable."
        });
        const resultStream = await model.generateContentStream(prompt);

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of resultStream.stream) {
                        const chunkText = chunk.text();
                        controller.enqueue(new TextEncoder().encode(chunkText));
                    }
                } catch (e) {
                    console.error("Stream error", e);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
            }
        });

    } catch (error: any) {
        console.error("Guidance API Error:", error);

        // Handle Gemini Rate Limits gracefully
        const isRateLimit = error?.status === 429 || error?.message?.includes("429");
        if (isRateLimit) {
            return NextResponse.json(
                { error: "The AI Advisor is currently experiencing high traffic and is rate-limited. Please wait 60 seconds and try again." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "An error occurred while analyzing the portfolio." },
            { status: 500 }
        );
    }
}
