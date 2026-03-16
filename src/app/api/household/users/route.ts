import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, TABLE_NAME } from "@/lib/db";
import { ScanCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const householdId = session?.user?.householdId;

        if (!session || !householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Scan for all USER records belonging to this household
        const { Items } = await db.send(
            new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: "begins_with(PK, :userPrefix) AND householdId = :hid",
                ExpressionAttributeValues: {
                    ":userPrefix": "USER#",
                    ":hid": householdId,
                },
            })
        );

        return NextResponse.json({ users: Items || [] });
    } catch (error) {
        console.error("Failed to fetch household users:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const householdId = session?.user?.householdId;

        if (!session || !householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { email } = await request.json();

        if (!email || !email.includes("@")) {
            return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
        }

        const USER_KEY = `USER#${email.toLowerCase().trim()}`;

        // Add or overwrite the user record to point to the current admin's household
        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: USER_KEY,
                    SK: USER_KEY,
                    email: email.toLowerCase().trim(),
                    householdId: householdId,
                    role: "MEMBER",
                    updatedAt: new Date().toISOString()
                }
            })
        );

        return NextResponse.json({ message: "User invited/added successfully" });
    } catch (error) {
        console.error("Failed to add user to household:", error);
        return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
    }
}

// Remove a user
export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const householdId = session?.user?.householdId;

        if (!session || !householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const USER_KEY = `USER#${email.toLowerCase().trim()}`;

        // Verify the user being removed is actually in this household
        const { Item: existingUser } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: USER_KEY, SK: USER_KEY }
            })
        );

        if (!existingUser || existingUser.householdId !== householdId) {
            return NextResponse.json({ error: "User not found in this household" }, { status: 404 });
        }

        // To "remove" them, we simply provision them a brand new, empty household sandbox
        const newIsolatedHouseholdId = crypto.randomUUID();

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    ...existingUser,
                    householdId: newIsolatedHouseholdId,
                    role: "ADMIN",
                    updatedAt: new Date().toISOString()
                }
            })
        );

        return NextResponse.json({ message: "User removed successfully" });
    } catch (error) {
        console.error("Failed to remove user:", error);
        return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
    }
}
