import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const ALLOWED_EMAILS = [
    "phbfreitas2@gmail.com",
];

export const authOptions = {
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
        async signIn({ user }: { user: any }) {
            if (user.email && ALLOWED_EMAILS.includes(user.email)) {
                return true;
            }
            return false; // Unauthorized email
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-change-in-prod",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
