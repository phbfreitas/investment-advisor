import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Investment Advisory Board",
  description: "Your personalized investment advisory board powered by the wisdom of legendary investors",
};

import { Providers } from "@/components/Providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 selection:bg-teal-500 selection:text-white flex flex-col md:flex-row md:overflow-hidden min-h-screen transition-colors duration-300`}>
        <Providers>
          {session ? (
            <>
              <Sidebar />
              <main className="flex-1 w-full pb-24 md:pb-0 md:h-dvh md:overflow-y-auto">
                {children}
              </main>
            </>
          ) : (
            <main className="flex-1 w-full flex flex-col items-center justify-center min-h-screen relative p-4 bg-gradient-to-br from-neutral-100 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-black transition-colors duration-300">
              {children}
            </main>
          )}
        </Providers>
      </body>
    </html>
  );
}
