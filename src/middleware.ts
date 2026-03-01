import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: '/login', // Redirect unauthenticated users to login page
    },
});

export const config = {
    // Math all request paths except for the ones starting with:
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};
