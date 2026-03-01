import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Warren Buffett Advisor",
  description: "Your personalized Warren Buffett advisor powered by his actual writings",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-950 text-neutral-50 selection:bg-teal-500 selection:text-white flex flex-col md:flex-row md:overflow-hidden min-h-screen`}>
        <Providers>
          <Sidebar />
          <main className="flex-1 w-full pb-24 md:pb-0 md:h-dvh md:overflow-y-auto">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
