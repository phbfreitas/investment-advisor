import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: '/login', // Redirect unauthenticated users to login page
    },
});

export const config = {
    // Explicitly protect these specific application routes
    matcher: ["/", "/dashboard/:path*", "/profile/:path*"],
};
