import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Warren Buffett Advisor",
  description: "Your personalized Warren Buffett advisor powered by his actual writings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-50 selection:bg-teal-500 selection:text-white flex flex-col md:flex-row overflow-hidden`}>
        <Sidebar />
        <main className="flex-1 w-full h-[calc(100vh-64px)] md:h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
