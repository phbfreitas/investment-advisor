import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/assets/[id] - Deletes an asset
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `PROFILE#${session.user.email}`;
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const assetSK = `ASSET#${id}`;

        await db.send(
            new DeleteCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: PROFILE_KEY,
                    SK: assetSK,
                }
            })
        );

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
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `PROFILE#${session.user.email}`;
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

        const updatedAsset = {
            ...existingAsset,
            account: data.account !== undefined ? data.account : existingAsset.account,
            ticker: data.ticker !== undefined ? data.ticker : existingAsset.ticker,
            securityType: data.securityType !== undefined ? data.securityType : existingAsset.securityType,
            strategyType: data.strategyType !== undefined ? data.strategyType : existingAsset.strategyType,
            call: data.call !== undefined ? data.call : existingAsset.call,
            sector: data.sector !== undefined ? data.sector : existingAsset.sector,
            market: data.market !== undefined ? data.market : existingAsset.market,
            currency: data.currency !== undefined ? data.currency : existingAsset.currency,
            managementStyle: data.managementStyle !== undefined ? data.managementStyle : existingAsset.managementStyle,
            externalRating: data.externalRating !== undefined ? data.externalRating : existingAsset.externalRating,

            managementFee: data.managementFee !== undefined ? parseFloat(data.managementFee) : existingAsset.managementFee,
            quantity: data.quantity !== undefined ? parseFloat(data.quantity) : existingAsset.quantity,
            liveTickerPrice: data.liveTickerPrice !== undefined ? parseFloat(data.liveTickerPrice) : existingAsset.liveTickerPrice,
            bookCost: data.bookCost !== undefined ? parseFloat(data.bookCost) : existingAsset.bookCost,
            marketValue: data.marketValue !== undefined ? parseFloat(data.marketValue) : existingAsset.marketValue,
            profitLoss: data.profitLoss !== undefined ? parseFloat(data.profitLoss) : existingAsset.profitLoss,
            yield: data.yield !== undefined ? parseFloat(data.yield) : existingAsset.yield,
            oneYearReturn: data.oneYearReturn !== undefined ? parseFloat(data.oneYearReturn) : existingAsset.oneYearReturn,
            fiveYearReturn: data.fiveYearReturn !== undefined ? parseFloat(data.fiveYearReturn) : existingAsset.fiveYearReturn,
            risk: data.risk !== undefined ? data.risk : existingAsset.risk,
            volatility: data.volatility !== undefined ? parseFloat(data.volatility) : existingAsset.volatility,
            expectedAnnualDividends: data.expectedAnnualDividends !== undefined ? parseFloat(data.expectedAnnualDividends) : existingAsset.expectedAnnualDividends,

            updatedAt: new Date().toISOString(),
        };

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: updatedAsset,
            })
        );

        return NextResponse.json({ message: "Asset updated successfully", asset: updatedAsset });
    } catch (error) {
        console.error("Failed to update asset:", error);
        return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
    }
}
