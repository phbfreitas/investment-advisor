import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { BatchWriteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";

interface ParsedHolding {
    ticker: string;
    quantity: number;
    bookCost: number;
    marketValue: number;
    accountNumber: string;
    accountType: string; // "Registered" or "Non-Registered"
    currency: string;
}

// Detect account type from text context
function classifyAccountType(text: string): string {
    const upper = text.toUpperCase();
    if (/TFSA|RRSP|RESP|RDSP|FHSA|LIRA|LIF|RRIF|DPSP/.test(upper)) return "Registered";
    if (/NON.?REG|MARGIN|CASH\s*ACCOUNT|TAXABLE/.test(upper)) return "Non-Registered";
    return "";
}

// Extract account number patterns
function extractAccountNumber(text: string): string {
    // Common patterns: "Account: 12345", "Account #: ABC123", "Acct# 12345"
    const patterns = [
        /Account\s*(?:#|Number|No\.?)?\s*:?\s*([A-Z0-9]{4,})/i,
        /Acct\s*#?\s*:?\s*([A-Z0-9]{4,})/i,
        /(?:^|\n)\s*#?\s*([A-Z0-9]{6,12})\s*(?:TFSA|RRSP|Non|Margin|Cash)/im,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return "";
}

// Parse holdings from PDF text — supports common Canadian brokerage formats
function parseHoldings(text: string): ParsedHolding[] {
    const holdings: ParsedHolding[] = [];
    const accountNumber = extractAccountNumber(text);
    const accountType = classifyAccountType(text);

    // Detect currency from document
    const currency = /CAD|Canadian/i.test(text) ? "CAD" : "USD";

    // Split into lines for row-by-row parsing
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Pattern: TICKER.TO or TICKER followed by numbers (qty, cost, value)
    // Matches lines like: "XQQ.TO 100 5,432.10 6,100.00"
    // or "RY 250 $12,500.00 $14,200.00"
    const holdingPattern = /^([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)\s+\$?([\d,]+(?:\.\d{2})?)/;

    for (const line of lines) {
        const match = line.match(holdingPattern);
        if (match) {
            const ticker = match[1];
            const quantity = parseFloat(match[2].replace(/,/g, ''));
            const bookCost = parseFloat(match[3].replace(/,/g, ''));
            const marketValue = parseFloat(match[4].replace(/,/g, ''));

            if (quantity > 0 && !isNaN(bookCost) && !isNaN(marketValue)) {
                holdings.push({
                    ticker,
                    quantity,
                    bookCost,
                    marketValue,
                    accountNumber,
                    accountType,
                    currency,
                });
            }
        }
    }

    // If regex didn't match, try a more lenient approach for table-like structures
    if (holdings.length === 0) {
        // Look for known ticker symbols in the text followed by numeric data
        const tickerPattern = /([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s.*?(\d[\d,]*(?:\.\d+)?)\s.*?\$?([\d,]+(?:\.\d{2})?)\s.*?\$?([\d,]+(?:\.\d{2})?)/g;
        let tickerMatch;
        while ((tickerMatch = tickerPattern.exec(text)) !== null) {
            const ticker = tickerMatch[1];
            const quantity = parseFloat(tickerMatch[2].replace(/,/g, ''));
            const bookCost = parseFloat(tickerMatch[3].replace(/,/g, ''));
            const marketValue = parseFloat(tickerMatch[4].replace(/,/g, ''));

            // Sanity check: reasonable values
            if (quantity > 0 && quantity < 1_000_000 && bookCost > 0 && marketValue > 0) {
                // Avoid duplicates
                if (!holdings.some(h => h.ticker === ticker)) {
                    holdings.push({
                        ticker,
                        quantity,
                        bookCost,
                        marketValue,
                        accountNumber,
                        accountType,
                        currency,
                    });
                }
            }
        }
    }

    return holdings;
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;

        const formData = await request.formData();
        const file = formData.get("file") as Blob;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Parse PDF
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        const text = pdfData.text;

        if (!text || text.trim().length === 0) {
            return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 400 });
        }

        // Parse holdings from extracted text
        const holdings = parseHoldings(text);

        if (holdings.length === 0) {
            return NextResponse.json({
                error: "No holdings detected in PDF. Ensure it contains a holdings table with ticker symbols, quantities, and values.",
                extractedTextPreview: text.substring(0, 500),
            }, { status: 400 });
        }

        // Ensure profile exists
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        if (!profile) {
            return NextResponse.json({ error: "Please setup your profile first" }, { status: 400 });
        }

        // Create asset records
        type WriteRequest = { PutRequest: { Item: Record<string, unknown> } };
        const writeRequests: WriteRequest[] = holdings.map(h => {
            const assetId = uuidv4();
            const pricePerShare = h.quantity > 0 ? h.marketValue / h.quantity : 0;

            return {
                PutRequest: {
                    Item: {
                        PK: PROFILE_KEY,
                        SK: `ASSET#${assetId}`,
                        id: assetId,
                        profileId: PROFILE_KEY,
                        type: "ASSET",
                        account: "",
                        ticker: h.ticker,
                        securityType: "",
                        strategyType: "",
                        call: "",
                        sector: "",
                        market: "",
                        currency: h.currency,
                        managementStyle: "",
                        externalRating: "",
                        managementFee: 0,
                        quantity: h.quantity,
                        liveTickerPrice: pricePerShare,
                        bookCost: h.bookCost,
                        marketValue: h.marketValue,
                        profitLoss: h.marketValue - h.bookCost,
                        yield: 0,
                        oneYearReturn: 0,
                        fiveYearReturn: 0,
                        threeYearReturn: 0,
                        exDividendDate: "",
                        analystConsensus: "",
                        beta: 0,
                        riskFlag: "",
                        accountNumber: h.accountNumber,
                        accountType: h.accountType,
                        risk: "",
                        volatility: 0,
                        expectedAnnualDividends: 0,
                        importSource: "pdf-statement",
                        updatedAt: new Date().toISOString(),
                    }
                }
            };
        });

        // DynamoDB BatchWriteItem limit: 25 per request
        const chunkSize = 25;
        for (let i = 0; i < writeRequests.length; i += chunkSize) {
            const chunk = writeRequests.slice(i, i + chunkSize);
            await db.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: chunk,
                    }
                })
            );
        }

        return NextResponse.json({
            message: "PDF statement imported successfully",
            count: holdings.length,
            holdings: holdings.map(h => ({ ticker: h.ticker, quantity: h.quantity, accountType: h.accountType })),
        });
    } catch (error) {
        console.error("Failed to process PDF statement:", error);
        return NextResponse.json({ error: "Failed to process PDF file" }, { status: 500 });
    }
}
