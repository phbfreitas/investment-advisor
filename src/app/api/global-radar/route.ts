import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { buildFullUserContext } from "@/lib/portfolio-analytics";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FORMATTING_RULES } from "@/lib/prompt-templates";
import { getCachedOrFreshNews, formatNewsContext } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Extended for Deep Critique parallel execution

const geminiApiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(geminiApiKey);

const SYSTEM_INSTRUCTION = `You are the world's most elite Chief Investment Officer (CIO) with deep expertise in geopolitical risk analysis and macro investing. Your communication style is "Executive Crispy": structured, data-driven, and action-oriented. You connect global news events directly to portfolio impacts with specific, actionable recommendations. Use sophisticated financial terminology correctly but keep the layout scannable.
Structure every response with H2/H3 headers, bullet points, and highly readable tables for comparisons.
NEVER use raw HTML tags like <br>. Use double-newlines for clean Markdown separation.
Your goal is to provide high-conviction, professional investment intelligence that connects real-world events to portfolio action.`;

const DIRECTIVE_NAMES: Record<number, string> = {
    1: "Net Worth Stress Test",
    2: "Deep Buy Scanner",
    3: "Opportunity Cost Evaluator",
    4: "Cross-Sectional Impact Report",
    5: "Full Strategy Critic",
};

function buildPrompt(directiveId: number, newsContext: string, portfolioContext: string): string {
    const contextBlock = `${FORMATTING_RULES}\nNEWS DIGEST:\n${newsContext}\n\nIMPORTANT: Always combine the news digest above with your own high-conviction assessment of prevailing global macro trends (interest rates, inflation, geopolitical tensions, commodity cycles, currency dynamics). The news digest provides real-time signals; layer your macro expertise on top to deliver a complete analysis.\n\nUSER PORTFOLIO & STRATEGY:\n${portfolioContext}`;

    switch (directiveId) {
        case 1:
            return `Act as my Chief Investment Officer (CIO). Analyze my liquid portfolio by comparing it to my real estate exposure and my cash flow objectives in both CAD and USD. Considering this week's global macro events from the news digest, identify where my 'Entire Strategy' is vulnerable (e.g., overexposure to the Canadian financial sector or a lack of global inflation protection). Do not focus solely on rebalancing asset classes; instead, suggest moves that protect the purchasing power of my total net worth.\n\n${contextBlock}`;
        case 2:
            return `Scan the global market for 'Deep Buy' and 'Cheap Value' opportunities. To be selected, an asset must meet three criteria: 1) A price drop driven by geopolitical or sector-specific panic from the news digest, not fundamental failure; 2) 30-day volatility (Beta) showing signs of selling exhaustion; 3) Valuation (P/E or P/B) significantly below the 5-year average. Present the top 3 options that complement my current portfolio without increasing the risk correlation with my existing holdings.\n\n${contextBlock}`;
        case 3:
            return `Based on the geopolitical news in the digest, evaluate the 'Opportunity Cost' of my current allocation. If the market is shifting toward a new regime (e.g., higher rates for longer, trade wars, energy transitions), which sectors of my entire strategy have become 'dead money'? Suggest a strategic rotation that maintains my passive income goal while capturing growth in sectors benefiting from new global trends (e.g., AI, Metals, Energy).\n\n${contextBlock}`;
        case 4:
            return `Analyze the key geopolitical and global macroeconomic news from the digest (focusing on interest rates, conflicts, and energy). Based on my strategy of 40% Growth, 40% Mix (Hybrids), and 20% Dividends, explain how these events altered the risk profile of each category. Do not just list news; specify how the current scenario favors or harms my goal of passive income vs. capital appreciation.\n\n${contextBlock}`;
        case 5:
            return `Compare my complete 40/40/20 strategy with the current performance of major global asset classes (S&P 500, TSX, Bonds, Commodities). Critique my portfolio: where am I overexposed? Where am I missing protection opportunities? Suggest rebalancing shifts based on macro trends from the news digest (e.g., persistent inflation or interest rate shifts) to ensure my monthly income and long-term growth remain protected.\n\n${contextBlock}`;
        default:
            return "";
    }
}

async function generateSingleAnalysis(directiveId: number, newsContext: string, portfolioContext: string): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = buildPrompt(directiveId, newsContext, portfolioContext);
    const result = await model.generateContent(prompt);
    return result.response.text();
}

export async function POST(request: Request) {
    if (!geminiApiKey) {
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
        const { directiveId, forceRefresh } = await request.json();

        if (!directiveId || directiveId < 1 || directiveId > 6) {
            return NextResponse.json({ error: "Invalid directive ID (1-6)" }, { status: 400 });
        }

        // Fetch user data
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        const [{ Items: assets }, { Items: cashflows }] = await Promise.all([
            db.send(
                new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": PROFILE_KEY,
                        ":skPrefix": "ASSET#",
                    },
                })
            ),
            db.send(
                new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": PROFILE_KEY,
                        ":skPrefix": "CASHFLOW#",
                    },
                    ScanIndexForward: false,
                })
            ),
        ]);

        const latestCashflow = cashflows && cashflows.length > 0 ? cashflows[0] : null;
        const assetsList = assets || [];

        // Fetch news
        const { articles, newsDate } = await getCachedOrFreshNews();
        const newsContext = formatNewsContext(articles);
        const portfolioContext = buildFullUserContext(profile || {}, assetsList, latestCashflow);

        // Build snapshot for cache comparison
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
            portfolioFingerprint: assetsList.map((a: Record<string, unknown>) => `${a.ticker}:${a.quantity}`).sort().join("|"),
            strategyFingerprint,
            newsDate,
        };

        const CACHE_SK = `RADAR#${directiveId}`;

        // Check cache (unless force refresh)
        if (!forceRefresh) {
            const { Item: cached } = await db.send(
                new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: PROFILE_KEY, SK: CACHE_SK },
                })
            );

            if (cached && cached.response) {
                const changedFields: string[] = [];
                const cachedSnapshot = cached.requestSnapshot || {};

                if (cachedSnapshot.strategy !== currentSnapshot.strategy) changedFields.push("Investment Strategy");
                if (cachedSnapshot.riskTolerance !== currentSnapshot.riskTolerance) changedFields.push("Risk Tolerance");
                if (cachedSnapshot.goals !== currentSnapshot.goals) changedFields.push("Financial Goals");
                if (cachedSnapshot.portfolioFingerprint !== currentSnapshot.portfolioFingerprint) changedFields.push("Portfolio Holdings");
                if (cachedSnapshot.strategyFingerprint !== currentSnapshot.strategyFingerprint) changedFields.push("Strategy Configuration");
                if (cachedSnapshot.newsDate !== currentSnapshot.newsDate) changedFields.push("News Digest");

                return new Response(cached.response, {
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Cache-Control": "no-cache",
                        "X-Radar-Last-Updated": cached.updatedAt || "",
                        "X-Radar-Changed-Fields": JSON.stringify(changedFields),
                    }
                });
            }
        }

        // Deep Critique (directive 6) — parallel execution with progress streaming
        if (directiveId === 6) {
            return handleDeepCritique(newsContext, portfolioContext, currentSnapshot, PROFILE_KEY, CACHE_SK);
        }

        // Single directive — stream response
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        const prompt = buildPrompt(directiveId, newsContext, portfolioContext);

        const stream = new ReadableStream({
            async start(controller) {
                const heartbeatInterval = setInterval(() => {
                    controller.enqueue(new TextEncoder().encode("\u200B"));
                }, 5000);

                let fullResponse = "";

                try {
                    const resultStream = await model.generateContentStream(prompt);
                    for await (const chunk of resultStream.stream) {
                        const chunkText = chunk.text();
                        fullResponse += chunkText;
                        controller.enqueue(new TextEncoder().encode(chunkText));
                    }

                    const now = new Date().toISOString();
                    await db.send(
                        new PutCommand({
                            TableName: TABLE_NAME,
                            Item: {
                                PK: PROFILE_KEY,
                                SK: CACHE_SK,
                                response: fullResponse,
                                updatedAt: now,
                                entityType: "RADAR_CACHE",
                                requestSnapshot: currentSnapshot,
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
        console.error("Global Radar API Error:", error);

        const err = error as { status?: number; message?: string };
        const isRateLimit = err?.status === 429 || err?.message?.includes("429");
        if (isRateLimit) {
            return NextResponse.json(
                { error: "The AI is currently rate-limited. Please wait 60 seconds and try again." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "An error occurred while running the analysis." },
            { status: 500 }
        );
    }
}

async function handleDeepCritique(
    newsContext: string,
    portfolioContext: string,
    currentSnapshot: Record<string, unknown>,
    profileKey: string,
    cacheSk: string
) {
    const stream = new ReadableStream({
        async start(controller) {
            const heartbeatInterval = setInterval(() => {
                controller.enqueue(new TextEncoder().encode("\u200B"));
            }, 5000);

            let fullResponse = "";

            try {
                // Fire all 5 analyses with 500ms stagger to reduce rate limit risk
                const analysisPromises = [1, 2, 3, 4, 5].map((id, index) =>
                    new Promise<{ id: number; result: string; error?: string }>(resolve => {
                        setTimeout(async () => {
                            try {
                                const result = await generateSingleAnalysis(id, newsContext, portfolioContext);
                                // Emit progress marker
                                const marker = `<!-- PROGRESS: ${id}/5 ${DIRECTIVE_NAMES[id]} complete -->\n`;
                                controller.enqueue(new TextEncoder().encode(marker));
                                resolve({ id, result });
                            } catch (e) {
                                const errMsg = e instanceof Error ? e.message : "Unknown error";
                                // Check for rate limit — retry once after 2s
                                if (errMsg.includes("429")) {
                                    try {
                                        await new Promise(r => setTimeout(r, 2000));
                                        const retryResult = await generateSingleAnalysis(id, newsContext, portfolioContext);
                                        const marker = `<!-- PROGRESS: ${id}/5 ${DIRECTIVE_NAMES[id]} complete -->\n`;
                                        controller.enqueue(new TextEncoder().encode(marker));
                                        resolve({ id, result: retryResult });
                                        return;
                                    } catch {
                                        // Retry failed
                                    }
                                }
                                const marker = `<!-- PROGRESS: ${id}/5 ${DIRECTIVE_NAMES[id]} failed -->\n`;
                                controller.enqueue(new TextEncoder().encode(marker));
                                resolve({ id, result: "", error: errMsg });
                            }
                        }, index * 500);
                    })
                );

                const results = await Promise.all(analysisPromises);

                // Build synthesis prompt
                const successfulAnalyses = results
                    .filter(r => r.result)
                    .map(r => `### ${DIRECTIVE_NAMES[r.id]}\n${r.result}`)
                    .join("\n\n---\n\n");

                const failedAnalyses = results
                    .filter(r => r.error)
                    .map(r => `- ${DIRECTIVE_NAMES[r.id]}: unavailable due to error`)
                    .join("\n");

                const synthesisPrompt = `You are given ${results.filter(r => r.result).length} separate expert analyses of the same investor's portfolio, each examining a different dimension. ${failedAnalyses ? `\n\nNote: The following analyses were unavailable:\n${failedAnalyses}\n` : ""}

Synthesize all findings into a single 1-page executive report structured as:
## Top 3 Immediate Actions
(What to change today to protect and grow the portfolio)
## Top 3 Deep Buy Stocks of the Week
(Best opportunities identified across all analyses)
## Single Biggest Risk
(The #1 vulnerability right now)
## Strategic Outlook
(1-paragraph forward-looking summary connecting all findings)

${FORMATTING_RULES}

EXPERT ANALYSES:
${successfulAnalyses}`;

                // Stream synthesis
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    systemInstruction: SYSTEM_INSTRUCTION,
                });

                const synthStream = await model.generateContentStream(synthesisPrompt);
                for await (const chunk of synthStream.stream) {
                    const chunkText = chunk.text();
                    fullResponse += chunkText;
                    controller.enqueue(new TextEncoder().encode(chunkText));
                }

                // Cache the synthesis
                const now = new Date().toISOString();
                await db.send(
                    new PutCommand({
                        TableName: TABLE_NAME,
                        Item: {
                            PK: profileKey,
                            SK: cacheSk,
                            response: fullResponse,
                            updatedAt: now,
                            entityType: "RADAR_CACHE",
                            requestSnapshot: currentSnapshot,
                        },
                    })
                );
            } catch (e) {
                console.error("Deep Critique error:", e);
                controller.enqueue(new TextEncoder().encode("\n\n**Error:** Failed to generate Deep Critique synthesis. Please try again."));
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
}
