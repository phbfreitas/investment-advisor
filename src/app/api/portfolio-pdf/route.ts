import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { BatchWriteCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractText, getDocumentProxy } from "unpdf";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import { researchTicker } from '@/lib/ticker-research';
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
} from '@/lib/classification/allowlists';
import type { AuditMutation } from "@/types/audit";
import { parseHoldings, extractAccountNumber } from "./parseHoldings";

export const dynamic = "force-dynamic";


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

        // --- REMOVED: Pre-emptive Linking (Caused audit log blind-spots) ---
        // We now handle matching and linking inside the main loop to ensure 
        // that all field changes (like accountNumber) are recorded in mutations.
        // ---------------------------------------------------------------------------

        // Cache for ticker research to avoid redundant API calls
        const tickerCache = new Map<string, any>();

        for (const h of holdings) {
            const pricePerShare = h.quantity > 0 ? h.marketValue / h.quantity : 0;
            const mappedName = h.accountNumber ? accountMappings[h.accountNumber] : "";
            const allMatches = existingAssets.filter((a: any) => a.ticker === h.ticker);
            let existing: any;

            // --- REFINED MATCHING: Account-Bound Only ---
            // 1. Try matching by Account Number (strictest)
            if (h.accountNumber) {
                existing = allMatches.find((a: any) => a.accountNumber === h.accountNumber);
            }
            
            // 2. Try matching by Account Name (if number match failed or asset has no number)
            if (!existing && mappedName) {
                existing = allMatches.find(a => a.account === mappedName);
            }

            // NOTE: Global "ticker-only" fallback is REMOVED to prevent cross-account contamination.
            // If no record exists for this specific account, we create a new one.
            // ---------------------------------------------

            // --- AI ENRICHMENT (New Logic) ---
            // If asset is new OR has missing metadata, attempt enrichment
            const needsMetadata =
                !existing ||
                !existing.strategyType || existing.strategyType === "Not Found" ||
                !existing.sector || existing.sector === "Not Found" ||
                !existing.securityType || existing.securityType === "Not Found";
            let enrichedData = null;
            
            if (needsMetadata) {
                if (tickerCache.has(h.ticker)) {
                    enrichedData = tickerCache.get(h.ticker);
                } else {
                    try {
                        enrichedData = await researchTicker(h.ticker);
                        tickerCache.set(h.ticker, enrichedData);
                    } catch (e) {
                        console.warn(`[portfolio-pdf] AI Enrichment failed for ${h.ticker}:`, e);
                    }
                }
            }
            // ---------------------------------

            const assetId = existing ? existing.id : uuidv4();
            const assetSK = `ASSET#${assetId}`;

            const securityType = normalizeSecurityType(
                (existing?.securityType && existing.securityType !== "" && existing.securityType !== "Not Found") ? existing.securityType : enrichedData?.securityType,
            );

            const baseItem = {
                PK: PROFILE_KEY,
                SK: assetSK,
                id: assetId,
                profileId: PROFILE_KEY,
                type: "ASSET",
                ticker: h.ticker,
                currency: normalizeCurrency(h.currency || enrichedData?.currency || existing?.currency || "CAD"),
                quantity: h.quantity,
                liveTickerPrice: pricePerShare > 0 ? pricePerShare : (enrichedData?.currentPrice ?? (existing?.liveTickerPrice ?? 0)),
                bookCost: h.bookCost,
                marketValue: h.marketValue,
                profitLoss: h.marketValue - h.bookCost,
                accountNumber: h.accountNumber || (existing?.accountNumber ?? ""),
                accountType: h.accountType || (existing?.accountType ?? "Registered"),
                importSource: "pdf-statement",
                updatedAt: new Date().toISOString(),
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                account: h.accountNumber && accountMappings[h.accountNumber] ? accountMappings[h.accountNumber] : (existing?.account ?? ""),

                securityType,
                strategyType: normalizeStrategyType(
                    (existing?.strategyType && existing.strategyType !== "" && existing.strategyType !== "Not Found") ? existing.strategyType : enrichedData?.strategyType,
                ),
                call: normalizeCall(
                    (existing?.call && existing.call !== "" && existing.call !== "N/A" && existing.call !== "Not Found") ? existing.call : enrichedData?.call,
                ),
                sector: normalizeSector(
                    (existing?.sector && existing.sector !== "" && existing.sector !== "N/A" && existing.sector !== "Not Found") ? existing.sector : enrichedData?.sector,
                ),
                market: normalizeMarket(
                    (existing?.market && existing.market !== "" && existing.market !== "Not Found") ? existing.market : enrichedData?.market,
                    securityType,
                ),
                managementStyle: normalizeManagementStyle(
                    (existing?.managementStyle && existing.managementStyle !== "" && existing.managementStyle !== "Not Found") ? existing.managementStyle : enrichedData?.managementStyle,
                ),
                name: (existing?.name && existing.name !== "") ? existing.name : (enrichedData?.name ?? ""),

                externalRating: existing?.externalRating ?? enrichedData?.externalRating ?? "",
                managementFee: existing?.managementFee ?? enrichedData?.managementFee ?? null,
                yield: existing?.yield ?? enrichedData?.dividendYield ?? null,
                oneYearReturn: existing?.oneYearReturn ?? enrichedData?.oneYearReturn ?? null,
                fiveYearReturn: existing?.fiveYearReturn ?? null,
                threeYearReturn: existing?.threeYearReturn ?? enrichedData?.threeYearReturn ?? null,
                exDividendDate: existing?.exDividendDate ?? enrichedData?.exDividendDate ?? "",
                analystConsensus: existing?.analystConsensus ?? enrichedData?.analystConsensus ?? "",
                beta: existing?.beta ?? enrichedData?.beta ?? 0,
                riskFlag: existing?.riskFlag ?? enrichedData?.riskFlag ?? "",
                risk: existing?.risk ?? "",
                volatility: existing?.volatility ?? enrichedData?.volatility ?? 0,
                expectedAnnualDividends: existing?.expectedAnnualDividends ?? 0,
            };

            const newItem = applyCompanyAutoDefaults(baseItem);

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
