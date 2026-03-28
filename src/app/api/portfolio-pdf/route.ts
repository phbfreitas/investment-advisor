import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { BatchWriteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractText, getDocumentProxy } from "unpdf";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import type { AuditMutation } from "@/types/audit";

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
        /Account No\.[^\n]*\n\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,15})\b/i,
        /(?:^|\n)\s*#?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,15})\s*(?:TFSA|RRSP|Non|Margin|Cash)/im,
        /Account\s*(?:#|Number|No\.?)?\s*:?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{4,15})/i,
        /Acct\s*#?\s*:?\s*:?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{4,15})/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            console.log("EXTRACTED ACCOUNT NUMBER: ", match[1], "using pattern:", pattern);
            return match[1];
        }
    }
    console.log("NO ACCOUNT NUMBER EXTRACTED FROM PDF!");
    return "";
}

function parseHoldings(text: string): ParsedHolding[] {
    const holdings: ParsedHolding[] = [];
    const accountNumber = extractAccountNumber(text);
    const accountType = classifyAccountType(text);

    // Detect currency from document
    const currency = /CAD|Canadian/i.test(text) ? "CAD" : "USD";

    // Split into lines for row-by-row parsing
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Standard Pattern: TICKER.TO or TICKER followed by numbers (qty, cost, value)
    // Safe generic holding pattern (Ticker Qty Price Value)
    const holdingPattern = /^([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)\s+\$?([\d,]+(?:\.\d{2})?)/;
    
    // Wealthsimple holdings line pattern (Ticker followed by at least 3 numeric quantities)
    const wsQtyPattern = /(?:^|\s)([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)(?:\s|$)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Try generic safe pattern
        const match = line.match(holdingPattern);
        if (match) {
            const ticker = match[1];
            const quantity = parseFloat(match[2].replace(/,/g, ''));
            const bookCost = parseFloat(match[3].replace(/,/g, ''));
            const marketValue = parseFloat(match[4].replace(/,/g, ''));

            if (quantity > 0 && !isNaN(bookCost) && !isNaN(marketValue)) {
                if (!holdings.some(h => h.ticker === ticker)) {
                    holdings.push({ ticker, quantity, bookCost, marketValue, accountNumber, accountType, currency });
                }
            }
            continue;
        }

        // 2. Try Wealthsimple specific pattern
        const wsMatch = line.match(wsQtyPattern);
        if (wsMatch) {
            if (line.includes("RECALL") || line.includes("LOAN") || line.includes("terminated")) continue;

            const ticker = wsMatch[1];
            const quantity = parseFloat(wsMatch[2].replace(/,/g, ''));
            const dollarAmounts: number[] = [];
            const dollarPattern = /\$([\d,]+(?:\.\d{2})?)/g;

            let execMatch;
            while ((execMatch = dollarPattern.exec(line)) !== null) {
                dollarAmounts.push(parseFloat(execMatch[1].replace(/,/g, '')));
            }

            for (let j = 1; j <= 6 && (i + j) < lines.length; j++) {
                if (lines[i+j].match(wsQtyPattern) && !lines[i+j].includes("RECALL") && !lines[i+j].includes("LOAN")) break;
                let nextMatch;
                while ((nextMatch = dollarPattern.exec(lines[i+j])) !== null) {
                    dollarAmounts.push(parseFloat(nextMatch[1].replace(/,/g, '')));
                }
            }

            if (dollarAmounts.length >= 3) {
                const marketValue = dollarAmounts[1];
                const bookCost = dollarAmounts[2];

                if (quantity > 0 && !isNaN(bookCost) && !isNaN(marketValue)) {
                    if (!holdings.some(h => h.ticker === ticker)) {
                        holdings.push({ ticker, quantity, bookCost, marketValue, accountNumber, accountType, currency });
                    }
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

        const url = new URL(request.url);
        const isPreview = url.searchParams.get("preview") === "true";

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;

        const formData = await request.formData();
        const file = formData.get("file") as Blob;
        const accountMappingsRaw = formData.get("accountMappings") as string;
        const accountMappings: Record<string, string> = accountMappingsRaw ? JSON.parse(accountMappingsRaw) : {};

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Parse PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
        const result = await extractText(pdf, { mergePages: false });
        const text = (result.text as string[]).join("\n");

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

        // If in preview mode, just return what we found
        if (isPreview) {
            const uniqueAccountNumbers = Array.from(new Set(holdings.map(h => h.accountNumber).filter(Boolean)));
            return NextResponse.json({
                preview: true,
                count: holdings.length,
                accounts: uniqueAccountNumbers,
                holdings: holdings.map(h => ({ ticker: h.ticker, quantity: h.quantity, accountNumber: h.accountNumber, accountType: h.accountType })),
            });
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

        // Fetch existing assets to update them instead of duplicating
        let existingAssets: any[] = [];
        try {
            const { Items } = await db.send(
                new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "PK = :pk AND begins_with(SK, :assetPrefix)",
                    ExpressionAttributeValues: {
                        ":pk": PROFILE_KEY,
                        ":assetPrefix": "ASSET#"
                    }
                })
            );
            existingAssets = Items || [];
        } catch (e) {
            console.error("Failed to query existing assets:", e);
        }

        // 4. Classify operations and build write requests + audit mutations
        type WriteRequest = { PutRequest?: { Item: Record<string, unknown> }, DeleteRequest?: { Key: Record<string, unknown> } };
        const writeRequests: WriteRequest[] = [];
        const mutations: AuditMutation[] = [];

        // Keep a snapshot of original assets to detect auto-linking changes later
        const originalAssetsSnapshot = JSON.parse(JSON.stringify(existingAssets));

        // --- NEW: Pre-emptive Linking (Fixes duplication & auto-link requirement) ---
        // If an account number in the PDF maps to a known account name, 
        // link all existing records for that name to this number IMMEDIATELY.
        const uniqueAcctNums = Array.from(new Set(holdings.map(h => h.accountNumber).filter(Boolean)));
        for (const acctNum of uniqueAcctNums) {
            const mappedName = accountMappings[acctNum];
            if (!mappedName) continue;

            for (let j = 0; j < existingAssets.length; j++) {
                const asset = existingAssets[j];
                const isMatchingName = asset.account === mappedName;
                const missingNumber = !asset.accountNumber || asset.accountNumber.trim() === '' || asset.accountNumber.toLowerCase() === 'n/a' || asset.accountNumber.toLowerCase() === 'closing';
                
                if (isMatchingName && missingNumber) {
                    // Update the local in-memory object so the loop below finds it correctly
                    existingAssets[j].accountNumber = acctNum;
                }
            }
        }
        // ---------------------------------------------------------------------------

        for (const h of holdings) {
            const pricePerShare = h.quantity > 0 ? h.marketValue / h.quantity : 0;
            const mappedName = h.accountNumber ? accountMappings[h.accountNumber] : "";
            const allMatches = existingAssets.filter(a => a.ticker === h.ticker);
            let existing;

            // Refined matching: Ticker + (AccountNumber OR AccountName)
            if (h.accountNumber) {
                existing = allMatches.find(a => a.accountNumber === h.accountNumber);
            }
            
            // Fallback to name match if number match failed
            if (!existing && mappedName) {
                existing = allMatches.find(a => a.account === mappedName);
            }

            // Ultimate fallback (legacy) - only if exactly one record exists with no number
            if (!existing) {
                const naMatches = allMatches.filter(a => !a.accountNumber || a.accountNumber.trim() === '' || a.accountNumber.trim().toLowerCase() === 'n/a' || a.accountNumber.trim().toLowerCase() === 'closing');
                if (naMatches.length === 1) existing = naMatches[0];
            }

            const assetId = existing ? existing.id : uuidv4();
            const assetSK = `ASSET#${assetId}`;

            const newItem = {
                PK: PROFILE_KEY,
                SK: assetSK,
                id: assetId,
                profileId: PROFILE_KEY,
                type: "ASSET",
                ticker: h.ticker,
                currency: h.currency || "CAD",
                quantity: h.quantity,
                liveTickerPrice: pricePerShare,
                bookCost: h.bookCost,
                marketValue: h.marketValue,
                profitLoss: h.marketValue - h.bookCost,
                accountNumber: h.accountNumber || (existing?.accountNumber ?? ""),
                accountType: h.accountType || (existing?.accountType ?? "Registered"),
                importSource: "pdf-statement",
                updatedAt: new Date().toISOString(),
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                account: h.accountNumber && accountMappings[h.accountNumber] ? accountMappings[h.accountNumber] : (existing?.account ?? ""),
                securityType: existing?.securityType ?? "",
                strategyType: existing?.strategyType ?? "",
                call: existing?.call ?? "",
                sector: existing?.sector ?? "",
                market: existing?.market ?? "",
                managementStyle: existing?.managementStyle ?? "",
                externalRating: existing?.externalRating ?? "",
                managementFee: existing?.managementFee ?? 0,
                yield: existing?.yield ?? 0,
                oneYearReturn: existing?.oneYearReturn ?? 0,
                fiveYearReturn: existing?.fiveYearReturn ?? 0,
                threeYearReturn: existing?.threeYearReturn ?? 0,
                exDividendDate: existing?.exDividendDate ?? "",
                analystConsensus: existing?.analystConsensus ?? "",
                beta: existing?.beta ?? 0,
                riskFlag: existing?.riskFlag ?? "",
                risk: existing?.risk ?? "",
                volatility: existing?.volatility ?? 0,
                expectedAnnualDividends: existing?.expectedAnnualDividends ?? 0,
            };

            writeRequests.push({ PutRequest: { Item: newItem } });

            // Classify for audit
            if (existing) {
                mutations.push({
                    action: 'UPDATE',
                    ticker: h.ticker,
                    assetSK,
                    before: toSnapshot(existing),
                    after: toSnapshot(newItem),
                });
            } else {
                mutations.push({
                    action: 'CREATE',
                    ticker: h.ticker,
                    assetSK,
                    before: null,
                    after: toSnapshot(newItem),
                });
            }
        }

        // 5. Secondary Pass for Auto-Linked Assets (not in current PDF)
        // If an asset was linked to an account number during pre-emptive linking 
        // but was NOT included in the current PDF holdings, we still update it in the DB
        // UNLESS it belongs to the account being synchronized (PDF is the Source of Truth).
        const pdfAccountNumber = holdings.length > 0 ? holdings[0].accountNumber : extractAccountNumber(text);
        const mappedAccountName = pdfAccountNumber ? accountMappings[pdfAccountNumber] : "";

        for (const asset of existingAssets) {
            const wasTouchedByHoldings = writeRequests.some(r => r.PutRequest?.Item.SK === asset.SK);
            const originalAsset = originalAssetsSnapshot.find((a: any) => a.SK === asset.SK);
            
            if (!wasTouchedByHoldings && asset.accountNumber !== originalAsset?.accountNumber) {
                // If this asset belongs to the specific account being synchronized from PDF,
                // and it was NOT in the PDF holdings (wasTouchedByHoldings is false), 
                // we skip the update here and let Pass 6 (Sync/Delete) remove it.
                if (asset.accountNumber === pdfAccountNumber || (mappedAccountName && asset.account === mappedAccountName)) {
                    continue;
                }

                const newItem = {
                    ...asset,
                    updatedAt: new Date().toISOString(),
                    // Ensure the account (name) is correctly set based on the mapping
                    account: asset.accountNumber ? (accountMappings[asset.accountNumber] || asset.account) : asset.account
                };
                writeRequests.push({ PutRequest: { Item: newItem } });
                mutations.push({
                    action: 'UPDATE',
                    ticker: asset.ticker,
                    assetSK: asset.SK,
                    before: toSnapshot(originalAsset),
                    after: toSnapshot(newItem),
                });
            }
        }

        // 6. Sync/Delete for assets belonging to this account but NOT in the holdings list
        // Note: For managed/manual assets that were auto-linked above, we preserve them
        if (pdfAccountNumber && pdfAccountNumber.trim() !== '') {
            // Broaden filter: Include anything with the same Account # OR same Account Name
            const existingAssetsForAccount = existingAssets.filter(a => 
                a.accountNumber === pdfAccountNumber || 
                (mappedAccountName && a.account === mappedAccountName)
            );
            
            for (const asset of existingAssetsForAccount) {
                const stillHoldsIt = holdings.some(h => h.ticker === asset.ticker);
                
                // DEDUPLICATION FIX:
                // Check if we already have a PutRequest for this asset SK (e.g. from the secondary pass)
                // DynamoDB BatchWriteCommand cannot contain multiple requests for the same key.
                const isAlreadyInWriteRequests = writeRequests.some(r => r.PutRequest?.Item.SK === asset.SK);
                
                if (!stillHoldsIt && !isAlreadyInWriteRequests) {
                    writeRequests.push({
                        DeleteRequest: {
                            Key: { PK: asset.PK, SK: asset.SK }
                        }
                    });
                    mutations.push({
                        action: 'DELETE',
                        ticker: asset.ticker,
                        assetSK: asset.SK,
                        before: toSnapshot(asset),
                        after: null,
                    });
                }
            }
        }

        // 6. DynamoDB BatchWriteItem with retry for unprocessed items
        const chunkSize = 25;
        for (let i = 0; i < writeRequests.length; i += chunkSize) {
            const chunk = writeRequests.slice(i, i + chunkSize);
            let unprocessed = chunk;
            let retries = 0;
            const maxRetries = 3;

            while (unprocessed.length > 0 && retries < maxRetries) {
                const result = await db.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [TABLE_NAME]: unprocessed,
                        }
                    })
                );

                const remaining = result.UnprocessedItems?.[TABLE_NAME];
                if (remaining && remaining.length > 0) {
                    unprocessed = remaining as WriteRequest[];
                    retries++;
                    // Exponential backoff before retry
                    await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries)));
                } else {
                    unprocessed = [];
                }
            }

            if (unprocessed.length > 0) {
                console.error(`Failed to process ${unprocessed.length} items after ${maxRetries} retries`);
                return NextResponse.json({
                    error: `Import partially failed. ${unprocessed.length} items could not be written.`,
                }, { status: 500 });
            }
        }

        // 7. Write audit log only after ALL chunks succeed (non-blocking)
        const filename = (formData.get("file") as File)?.name || "unknown.pdf";
        if (mutations.length > 0) {
            try {
                await insertAuditLog(session.user.householdId, 'PDF_IMPORT', mutations, filename);
            } catch (auditErr) {
                console.error("Failed to write audit log (import still succeeded):", auditErr);
            }
        }

        return NextResponse.json({
            message: "PDF statement imported successfully",
            count: holdings.length,
            holdings: holdings.map(h => ({ ticker: h.ticker, quantity: h.quantity, accountType: h.accountType })),
            mutations: mutations.map(m => ({
                action: m.action,
                ticker: m.ticker,
                assetSK: m.assetSK,
                ...(m.action === 'DELETE' && m.before ? { before: m.before } : {}),
            })),
        });
    } catch (error) {
        console.error("Failed to process PDF statement:", error);
        const message = error instanceof Error ? error.message : "Failed to process PDF file";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
