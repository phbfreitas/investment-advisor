import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { formatStrategyContext } from "@/lib/portfolio-analytics";
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
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;
        const { directiveId, ticker, forceRefresh } = await request.json();

        if (!directiveId) {
            return NextResponse.json({ error: "Directive ID is required" }, { status: 400 });
        }

        // Cache Key Logic
        const CACHE_SK = `GUIDANCE#${directiveId}#${ticker || ""}`;

        // Fetch User Context FIRST to build the snapshot
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

        // Build Current Snapshot for Comparison
        const assetsList = assets || [];

        const strategyFingerprint = JSON.stringify({
            assetMixGrowth: profile?.assetMixGrowth || 0,
            assetMixIncome: profile?.assetMixIncome || 0,
            assetMixMixed: profile?.assetMixMixed || 0,
            philosophies: (profile?.philosophies || []).slice().sort().join(","),
            corePrinciples: (profile?.corePrinciples || []).slice().sort().join(","),
            accountTypes: (profile?.accountTypes || []).slice().sort().join(","),
            tradingMethodologies: (profile?.tradingMethodologies || []).slice().sort().join(","),
            sectorAllocation: JSON.stringify(profile?.sectorAllocation || {}),
            geographicExposure: JSON.stringify(profile?.geographicExposure || {}),
            targetAnnualReturn: profile?.targetAnnualReturn || 0,
            targetMonthlyDividend: profile?.targetMonthlyDividend || 0,
        });

        const currentSnapshot = {
            strategy: profile?.strategy || "Not specified",
            riskTolerance: profile?.riskTolerance || "Not specified",
            goals: profile?.goals || "Not specified",
            portfolioFingerprint: assetsList.map(a => `${a.ticker}:${a.quantity}`).sort().join("|"),
            strategyFingerprint,
        };

        // 1. Check Cache first (unless force refresh)
        if (!forceRefresh) {
            const { Item: cached } = await db.send(
                new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: PROFILE_KEY, SK: CACHE_SK },
                })
            );

            if (cached && cached.response) {
                // Compare snapshots
                const changedFields: string[] = [];
                const cachedSnapshot = cached.requestSnapshot || {};

                if (cachedSnapshot.strategy !== currentSnapshot.strategy) changedFields.push("Investment Strategy");
                if (cachedSnapshot.riskTolerance !== currentSnapshot.riskTolerance) changedFields.push("Risk Tolerance");
                if (cachedSnapshot.goals !== currentSnapshot.goals) changedFields.push("Financial Goals");
                if (cachedSnapshot.portfolioFingerprint !== currentSnapshot.portfolioFingerprint) changedFields.push("Portfolio Holdings");
                if (cachedSnapshot.strategyFingerprint !== currentSnapshot.strategyFingerprint) changedFields.push("Strategy Configuration");

                // Return cached response instantly
                return new Response(cached.response, {
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Cache-Control": "no-cache",
                        "X-Guidance-Last-Updated": cached.updatedAt || "",
                        "X-Guidance-Changed-Fields": JSON.stringify(changedFields),
                    }
                });
            }
        }

        // Build context string from profile and assets
        const assetSummary = assetsList.length > 0
            ? assetsList.map(a => `- ${a.quantity} units of ${a.ticker} (Cost: $${a.bookCost}, Value: $${a.marketValue}, Yield: ${a.yield}%)`).join("\n")
            : "No assets documented.";

        const strategyContext = formatStrategyContext(profile || {});

        const contextString = `
USER PORTFOLIO DATA:
Strategy: ${profile?.strategy || "Not specified"}
Risk Tolerance: ${profile?.riskTolerance || "Not specified"}
Goals: ${profile?.goals || "Not specified"}
${strategyContext ? strategyContext + "\n" : ""}Assets:
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
- NEVER use raw HTML or <br> tags. Only use Markdown.
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
            model: "gemini-3.1-pro-preview", // Re-upgraded to massive model, timeout bypassed via stream padding
            systemInstruction: `You are the world's most elite Chief Investment Officer (CIO). 
Your communication style is "Executive Crispy": immaculate, highly structured, and visually elite. 
You avoid generic filler. You use sophisticated financial terminology correctly but keep the layout scannable.
Structure every response with H2/H3 headers, bullet points, and highly readable tables for comparisons.
NEVER use raw HTML tags like <br>. Use double-newlines for clean Markdown separation.
Your goal is to provide high-conviction, professional investment intelligence.`
        });

        const stream = new ReadableStream({
            async start(controller) {
                // Keep-alive heartbeat to bypass AWS CloudFront 30s connection limits 
                // We emit a zero-width space every 5 seconds before the actual LLM responds.
                const heartbeatInterval = setInterval(() => {
                    const invisibleByte = '\u200B';
                    controller.enqueue(new TextEncoder().encode(invisibleByte));
                }, 5000);

                let fullResponse = "";

                try {
                    const resultStream = await model.generateContentStream(prompt);
                    for await (const chunk of resultStream.stream) {
                        const chunkText = chunk.text();
                        fullResponse += chunkText; // Accumulate the response to save
                        controller.enqueue(new TextEncoder().encode(chunkText));
                    }

                    // Save to DynamoDB after stream finishes successfully
                    const now = new Date().toISOString();
                    await db.send(
                        new PutCommand({
                            TableName: TABLE_NAME,
                            Item: {
                                PK: PROFILE_KEY,
                                SK: CACHE_SK,
                                response: fullResponse,
                                updatedAt: now,
                                entityType: "CACHE",
                                requestSnapshot: currentSnapshot, // Save fingerprint for future comparisons
                            },
                        })
                    );
                } catch (e) {
                    console.error("Stream error", e);
                } finally {
                    clearInterval(heartbeatInterval);
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

    } catch (error) {
        console.error("Guidance API Error:", error);

        // Handle Gemini Rate Limits gracefully
        const err = error as { status?: number; message?: string };
        const isRateLimit = err?.status === 429 || err?.message?.includes("429");
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
