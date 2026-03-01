import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_EMAILS = [
    "phbfreitas2@gmail.com",
    "sialvesamaral@gmail.com",
];

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
            if (user.email && ALLOWED_EMAILS.includes(user.email)) {
                return true;
            }
            return false;
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-change-in-prod",
};
