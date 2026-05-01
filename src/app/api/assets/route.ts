import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
} from "@/lib/classification/allowlists";

export const dynamic = "force-dynamic";

// POST /api/assets - Adds a new manual asset row
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;
        const data = await request.json();

        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        if (!profile) {
            return NextResponse.json({ error: "Please setup your profile first" }, { status: 400 });
        }

        const assetId = uuidv4();
        const assetSK = `ASSET#${assetId}`;

        const securityType = normalizeSecurityType(data.securityType);
        const baseAsset = {
            PK: PROFILE_KEY,
            SK: assetSK,
            id: assetId,
            profileId: PROFILE_KEY,
            type: "ASSET" as const,

            account: data.account || "",
            ticker: data.ticker || "",
            securityType,
            strategyType: normalizeStrategyType(data.strategyType),
            call: normalizeCall(data.call),
            sector: normalizeSector(data.sector),
            market: normalizeMarket(data.market, securityType),
            currency: normalizeCurrency(data.currency),
            managementStyle: normalizeManagementStyle(data.managementStyle),
            externalRating: data.externalRating || "",

            managementFee: data.managementFee != null && data.managementFee !== "" ? parseFloat(data.managementFee) : null,
            quantity: parseFloat(data.quantity) || 0,
            liveTickerPrice: parseFloat(data.liveTickerPrice) || 0,
            bookCost: parseFloat(data.bookCost) || 0,
            marketValue: parseFloat(data.marketValue) || (parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0),
            profitLoss: parseFloat(data.profitLoss) || ((parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0)) - (parseFloat(data.bookCost) || 0),
            yield: data.yield != null && data.yield !== "" ? parseFloat(data.yield) : null,
            oneYearReturn: data.oneYearReturn != null && data.oneYearReturn !== "" ? parseFloat(data.oneYearReturn) : null,
            fiveYearReturn: data.fiveYearReturn != null && data.fiveYearReturn !== "" ? parseFloat(data.fiveYearReturn) : null,
            threeYearReturn: data.threeYearReturn != null && data.threeYearReturn !== "" ? parseFloat(data.threeYearReturn) : null,
            exDividendDate: data.exDividendDate || "",
            analystConsensus: data.analystConsensus || "",
            beta: parseFloat(data.beta) || 0,
            riskFlag: data.riskFlag || "",
            accountNumber: data.accountNumber || "",
            accountType: data.accountType || "",
            risk: data.risk || "",
            volatility: parseFloat(data.volatility) || 0,
            expectedAnnualDividends: parseFloat(data.expectedAnnualDividends) || (parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0) * (parseFloat(data.yield) || 0),

            userOverrides: data.userOverrides && typeof data.userOverrides === "object" ? data.userOverrides : undefined,
            marketComputedAt: typeof data.marketComputedAt === "string" || data.marketComputedAt === null ? data.marketComputedAt : undefined,

            updatedAt: new Date().toISOString(),
        };

        const asset = applyCompanyAutoDefaults(baseAsset);

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: asset,
            })
        );

        // Audit log: record creation
        await insertAuditLog(session.user.householdId, 'MANUAL_EDIT', [{
            action: 'CREATE',
            ticker: asset.ticker,
            assetSK: asset.SK,
            before: null,
            after: toSnapshot(asset),
        }], asset.ticker);

        return NextResponse.json({ message: "Asset added successfully", asset });
    } catch (error) {
        console.error("Failed to add manual asset:", error);
        return NextResponse.json({ error: "Failed to add manual asset" }, { status: 500 });
    }
}
