import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
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

// DELETE /api/assets/[id] - Deletes an asset
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const assetSK = `ASSET#${id}`;

        // Fetch existing asset before deletion for audit snapshot
        const { Item: existingAsset } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: assetSK },
            })
        );

        if (!existingAsset) {
            return NextResponse.json({ error: "Asset not found" }, { status: 404 });
        }

        await db.send(
            new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: assetSK }
            })
        );

        // Audit log: record deletion
        await insertAuditLog(session.user.householdId, 'MANUAL_EDIT', [{
            action: 'DELETE',
            ticker: existingAsset.ticker || "",
            assetSK,
            before: toSnapshot(existingAsset),
            after: null,
        }], existingAsset.ticker || "");

        return NextResponse.json({ message: "Asset deleted successfully" });
    } catch (error) {
        console.error("Failed to delete asset:", error);
        return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
    }
}

// PUT /api/assets/[id] - Updates an asset
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const assetSK = `ASSET#${id}`;
        const data = await request.json();

        const { Item: existingAsset } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: assetSK },
            })
        );

        if (!existingAsset) {
            return NextResponse.json({ error: "Asset not found" }, { status: 404 });
        }

        const incomingSecurityType = data.securityType !== undefined
            ? normalizeSecurityType(data.securityType)
            : normalizeSecurityType(existingAsset.securityType);

        const merged = {
            ...existingAsset,
            account: data.account !== undefined ? data.account : existingAsset.account,
            ticker: data.ticker !== undefined ? data.ticker : existingAsset.ticker,
            securityType: incomingSecurityType,
            strategyType: data.strategyType !== undefined
                ? normalizeStrategyType(data.strategyType)
                : normalizeStrategyType(existingAsset.strategyType),
            call: data.call !== undefined
                ? normalizeCall(data.call)
                : normalizeCall(existingAsset.call),
            sector: data.sector !== undefined
                ? normalizeSector(data.sector)
                : normalizeSector(existingAsset.sector),
            market: data.market !== undefined
                ? normalizeMarket(data.market, incomingSecurityType)
                : normalizeMarket(existingAsset.market, incomingSecurityType),
            currency: data.currency !== undefined
                ? normalizeCurrency(data.currency)
                : normalizeCurrency(existingAsset.currency),
            managementStyle: data.managementStyle !== undefined
                ? normalizeManagementStyle(data.managementStyle)
                : normalizeManagementStyle(existingAsset.managementStyle),
            externalRating: data.externalRating !== undefined ? data.externalRating : existingAsset.externalRating,

            managementFee: data.managementFee !== undefined
                ? (data.managementFee === "" || data.managementFee == null ? null : parseFloat(data.managementFee))
                : (existingAsset.managementFee ?? null),
            quantity: data.quantity !== undefined ? parseFloat(data.quantity) : existingAsset.quantity,
            liveTickerPrice: data.liveTickerPrice !== undefined ? parseFloat(data.liveTickerPrice) : existingAsset.liveTickerPrice,
            bookCost: data.bookCost !== undefined ? parseFloat(data.bookCost) : existingAsset.bookCost,
            marketValue: data.marketValue !== undefined ? parseFloat(data.marketValue) : existingAsset.marketValue,
            profitLoss: data.profitLoss !== undefined ? parseFloat(data.profitLoss) : existingAsset.profitLoss,
            yield: data.yield !== undefined
                ? (data.yield === "" || data.yield == null ? null : parseFloat(data.yield))
                : (existingAsset.yield ?? null),
            oneYearReturn: data.oneYearReturn !== undefined
                ? (data.oneYearReturn === "" || data.oneYearReturn == null ? null : parseFloat(data.oneYearReturn))
                : (existingAsset.oneYearReturn ?? null),
            fiveYearReturn: data.fiveYearReturn !== undefined
                ? (data.fiveYearReturn === "" || data.fiveYearReturn == null ? null : parseFloat(data.fiveYearReturn))
                : (existingAsset.fiveYearReturn ?? null),
            threeYearReturn: data.threeYearReturn !== undefined
                ? (data.threeYearReturn === "" || data.threeYearReturn == null ? null : parseFloat(data.threeYearReturn))
                : (existingAsset.threeYearReturn ?? null),
            exDividendDate: data.exDividendDate !== undefined ? data.exDividendDate : (existingAsset.exDividendDate ?? ""),
            analystConsensus: data.analystConsensus !== undefined ? data.analystConsensus : (existingAsset.analystConsensus ?? ""),
            beta: data.beta !== undefined ? parseFloat(data.beta) : (existingAsset.beta ?? 0),
            riskFlag: data.riskFlag !== undefined ? data.riskFlag : (existingAsset.riskFlag ?? ""),
            accountNumber: data.accountNumber !== undefined ? data.accountNumber : (existingAsset.accountNumber ?? ""),
            accountType: data.accountType !== undefined ? data.accountType : (existingAsset.accountType ?? ""),
            risk: data.risk !== undefined ? data.risk : existingAsset.risk,
            volatility: data.volatility !== undefined ? parseFloat(data.volatility) : existingAsset.volatility,
            expectedAnnualDividends: data.expectedAnnualDividends !== undefined ? parseFloat(data.expectedAnnualDividends) : existingAsset.expectedAnnualDividends,

            userOverrides: data.userOverrides !== undefined ? data.userOverrides : existingAsset.userOverrides,
            marketComputedAt: data.marketComputedAt !== undefined ? data.marketComputedAt : existingAsset.marketComputedAt,
            updatedAt: new Date().toISOString(),
        };

        const updatedAsset = applyCompanyAutoDefaults(merged);

        // Auto-recompute derived fields when inputs change
        const qty = updatedAsset.quantity || 0;
        const price = updatedAsset.liveTickerPrice || 0;
        const yieldPct = updatedAsset.yield ?? 0;
        const totalBookCost = updatedAsset.bookCost || 0;
        if (qty > 0 && price > 0) {
            updatedAsset.marketValue = qty * price;
            updatedAsset.profitLoss = updatedAsset.marketValue - totalBookCost;
            if (yieldPct > 0) {
                updatedAsset.expectedAnnualDividends = qty * price * yieldPct;
            }
        }

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: updatedAsset,
            })
        );

        // Audit log: record update
        await insertAuditLog(session.user.householdId, 'MANUAL_EDIT', [{
            action: 'UPDATE',
            ticker: updatedAsset.ticker,
            assetSK,
            before: toSnapshot(existingAsset),
            after: toSnapshot(updatedAsset),
        }], updatedAsset.ticker);

        return NextResponse.json({ message: "Asset updated successfully", asset: updatedAsset });
    } catch (error) {
        console.error("Failed to update asset:", error);
        return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
    }
}
