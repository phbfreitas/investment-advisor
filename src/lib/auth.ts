import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import * as crypto from "crypto";

const ALLOWED_EMAILS = [
    "phbfreitas2@gmail.com",
    "sialvesamaral@gmail.com",
];

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async signIn({ user }) {
            // Anyone can sign in. The JWT callback will either connect them to their invited
            // Household or provision a brand new, isolated sandbox household for them.
            if (user.email) {
                return true;
            }
            return false;
        },
        async jwt({ token, user }) {
            const email = user?.email || token?.email;

            // If we don't have a householdId in the token yet, we MUST fetch it or provision one.
            // This ensures users with active sessions prior to this update still get assigned correctly.
            if (!token.householdId && email) {
                const lowerEmail = email.toLowerCase().trim();
                try {
                    // Check if this user already belongs to a household
                    const response = await db.send(new GetCommand({
                        TableName: TABLE_NAME,
                        Key: {
                            PK: `USER#${lowerEmail}`,
                            SK: `USER#${lowerEmail}`
                        }
                    }));

                    if (response.Item && response.Item.householdId) {
                        token.householdId = response.Item.householdId;
                    } else {
                        // Provision a brand new Household for this user
                        const newHouseholdId = crypto.randomUUID();
                        await db.send(new PutCommand({
                            TableName: TABLE_NAME,
                            Item: {
                                PK: `USER#${lowerEmail}`,
                                SK: `USER#${lowerEmail}`,
                                email: lowerEmail,
                                householdId: newHouseholdId,
                                role: "ADMIN",
                                updatedAt: new Date().toISOString()
                            }
                        }));
                        token.householdId = newHouseholdId;
                    }
                } catch (error) {
                    console.error("Error fetching/creating household ID in JWT callback", error);
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // Override types dynamically to inject the retrieved householdId
                (session.user as any).householdId = token.householdId;
            }
            return session;
        }
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-change-in-prod",
};
