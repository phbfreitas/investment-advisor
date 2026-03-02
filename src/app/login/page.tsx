"use client";

import { signIn } from "next-auth/react";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-gray-950 p-4 transition-colors duration-300">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-800 rounded-2xl shadow-2xl p-8 space-y-8 transition-colors duration-300">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-500/20 transition-colors duration-300">
                        <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Investment Advisor</h1>
                    <p className="text-sm text-neutral-500 dark:text-gray-400">Secure access restricted to authorized family members.</p>
                </div>

                <div className="space-y-6">
                    {error === "AccessDenied" && (
                        <div className="text-red-400 text-sm text-center bg-red-400/10 py-3 rounded-lg border border-red-400/20">
                            Your email address is not authorized to access this personal application.
                        </div>
                    )}

                    <button
                        onClick={() => signIn("google", { callbackUrl: "/" })}
                        className="w-full flex justify-center items-center space-x-3 py-3 px-4 border border-neutral-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-neutral-900 dark:text-white bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-300 dark:focus:ring-gray-500 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-1 7.28-2.69l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.87 0-5.3-1.94-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.11c-.22-.69-.35-1.43-.35-2.11s.13-1.42.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"
                                fill="#EA4335"
                            />
                        </svg>
                        <span>Sign in with Google</span>
                    </button>
                    <p className="text-xs text-center text-neutral-500 dark:text-gray-500 mt-4">Protected by NextAuth and Google OAuth</p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-50 dark:bg-gray-950 flex items-center justify-center"><div className="animate-spin h-8 w-8 text-teal-600 dark:text-blue-500 rounded-full border-4 border-solid border-current border-r-transparent"></div></div>}>
            <LoginContent />
        </Suspense>
    );
}
