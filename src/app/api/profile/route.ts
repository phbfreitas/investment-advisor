import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;

        // Fetch the profile
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: PROFILE_KEY,
                    SK: "META",
                },
            })
        );

        // Fetch associated assets
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

        const responseData = profile ? { ...profile, assets: assets || [] } : {};
        return NextResponse.json(responseData);
    } catch (error) {
        console.error("Failed to fetch profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;
        const data = await request.json();

        // Fetch existing to avoid nuking fields not included in the current payload
        const { Item: existingProfile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        // Validate percentage sums (only when non-zero values present)
        const mixSum = (data.assetMixGrowth || 0) + (data.assetMixIncome || 0) + (data.assetMixMixed || 0);
        if (mixSum > 0 && Math.abs(mixSum - 100) > 0.01) {
            return NextResponse.json({ error: "Asset mix percentages must sum to 100%" }, { status: 400 });
        }

        if (data.sectorAllocation) {
            const sectorSum = Object.values(data.sectorAllocation as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
            if (sectorSum > 0 && Math.abs(sectorSum - 100) > 0.01) {
                return NextResponse.json({ error: "Sector allocation must sum to 100%" }, { status: 400 });
            }
        }

        if (data.geographicExposure) {
            const geoSum = Object.values(data.geographicExposure as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
            if (geoSum > 0 && Math.abs(geoSum - 100) > 0.01) {
                return NextResponse.json({ error: "Geographic exposure must sum to 100%" }, { status: 400 });
            }
        }

        // Put operation naturally updates or creates
        const profileData = {
            PK: PROFILE_KEY,
            SK: "META",
            type: "PROFILE",
            strategy: data.strategy !== undefined ? data.strategy : existingProfile?.strategy,
            riskTolerance: data.riskTolerance !== undefined ? data.riskTolerance : existingProfile?.riskTolerance,
            goals: data.goals !== undefined ? data.goals : existingProfile?.goals,
            budgetPaycheck: data.budgetPaycheck !== undefined ? data.budgetPaycheck : existingProfile?.budgetPaycheck,
            budgetRentalIncome: data.budgetRentalIncome !== undefined ? data.budgetRentalIncome : existingProfile?.budgetRentalIncome,
            budgetDividends: data.budgetDividends !== undefined ? data.budgetDividends : existingProfile?.budgetDividends,
            budgetBonus: data.budgetBonus !== undefined ? data.budgetBonus : existingProfile?.budgetBonus,
            budgetOtherIncome: data.budgetOtherIncome !== undefined ? data.budgetOtherIncome : existingProfile?.budgetOtherIncome,
            budgetFixedHome: data.budgetFixedHome !== undefined ? data.budgetFixedHome : existingProfile?.budgetFixedHome,
            budgetFixedUtilities: data.budgetFixedUtilities !== undefined ? data.budgetFixedUtilities : existingProfile?.budgetFixedUtilities,
            budgetFixedCar: data.budgetFixedCar !== undefined ? data.budgetFixedCar : existingProfile?.budgetFixedCar,
            budgetFixedFood: data.budgetFixedFood !== undefined ? data.budgetFixedFood : existingProfile?.budgetFixedFood,
            budgetDiscretionary: data.budgetDiscretionary !== undefined ? data.budgetDiscretionary : existingProfile?.budgetDiscretionary,
            budgetRentalExpenses: data.budgetRentalExpenses !== undefined ? data.budgetRentalExpenses : existingProfile?.budgetRentalExpenses,

            // Personal Wealth Fields
            wealthAssetCash: data.wealthAssetCash !== undefined ? data.wealthAssetCash : existingProfile?.wealthAssetCash,
            wealthAssetCar: data.wealthAssetCar !== undefined ? data.wealthAssetCar : existingProfile?.wealthAssetCar,
            wealthAssetPrimaryResidence: data.wealthAssetPrimaryResidence !== undefined ? data.wealthAssetPrimaryResidence : existingProfile?.wealthAssetPrimaryResidence,
            wealthAssetRentalProperties: data.wealthAssetRentalProperties !== undefined ? data.wealthAssetRentalProperties : existingProfile?.wealthAssetRentalProperties,

            wealthLiabilityMortgage: data.wealthLiabilityMortgage !== undefined ? data.wealthLiabilityMortgage : existingProfile?.wealthLiabilityMortgage,
            wealthLiabilityHeloc: data.wealthLiabilityHeloc !== undefined ? data.wealthLiabilityHeloc : existingProfile?.wealthLiabilityHeloc,
            wealthLiabilityRentalMortgage: data.wealthLiabilityRentalMortgage !== undefined ? data.wealthLiabilityRentalMortgage : existingProfile?.wealthLiabilityRentalMortgage,
            wealthLiabilityRentalHeloc: data.wealthLiabilityRentalHeloc !== undefined ? data.wealthLiabilityRentalHeloc : existingProfile?.wealthLiabilityRentalHeloc,
            wealthLiabilityCreditCards: data.wealthLiabilityCreditCards !== undefined ? data.wealthLiabilityCreditCards : existingProfile?.wealthLiabilityCreditCards,
            wealthLiabilityCarLease: data.wealthLiabilityCarLease !== undefined ? data.wealthLiabilityCarLease : existingProfile?.wealthLiabilityCarLease,

            // Strategy Configuration
            assetMixGrowth: data.assetMixGrowth !== undefined ? data.assetMixGrowth : existingProfile?.assetMixGrowth,
            assetMixIncome: data.assetMixIncome !== undefined ? data.assetMixIncome : existingProfile?.assetMixIncome,
            assetMixMixed: data.assetMixMixed !== undefined ? data.assetMixMixed : existingProfile?.assetMixMixed,
            philosophies: data.philosophies !== undefined ? data.philosophies : existingProfile?.philosophies,
            corePrinciples: data.corePrinciples !== undefined ? data.corePrinciples : existingProfile?.corePrinciples,
            accountTypes: data.accountTypes !== undefined ? data.accountTypes : existingProfile?.accountTypes,
            tradingMethodologies: data.tradingMethodologies !== undefined ? data.tradingMethodologies : existingProfile?.tradingMethodologies,
            sectorAllocation: data.sectorAllocation !== undefined ? data.sectorAllocation : existingProfile?.sectorAllocation,
            geographicExposure: data.geographicExposure !== undefined ? data.geographicExposure : existingProfile?.geographicExposure,
            targetAnnualReturn: data.targetAnnualReturn !== undefined ? data.targetAnnualReturn : existingProfile?.targetAnnualReturn,
            targetMonthlyDividend: data.targetMonthlyDividend !== undefined ? data.targetMonthlyDividend : existingProfile?.targetMonthlyDividend,

            updatedAt: new Date().toISOString(),
        };

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: profileData,
            })
        );

        return NextResponse.json(profileData);
    } catch (error) {
        console.error("Failed to save profile:", error);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
}
