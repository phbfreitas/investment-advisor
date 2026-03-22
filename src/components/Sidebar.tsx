"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, Settings, BrainCircuit, LogOut, Wallet, Target, BookOpen, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navigation = [
    { name: "Expert Guidance", href: "/", icon: Users },
    { name: "My Investment Portfolio", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Finance Summary", href: "/finance-summary", icon: Wallet },
    { name: "My Investment Strategy", href: "/profile", icon: BrainCircuit },
    { name: "AI Guidance", href: "/profile/guidance", icon: Target },
    { name: "Global News Guidance", href: "/global-radar", icon: Globe },
    { name: "User Guide", href: "/user-guide", icon: BookOpen },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex fixed bottom-0 left-0 right-0 z-50 md:relative md:h-full w-full md:w-64 flex-row md:flex-col bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md md:bg-neutral-50 dark:md:bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-neutral-200 dark:border-neutral-800 shrink-0 transition-colors duration-300">
            <div className="md:h-16 shrink-0 items-center px-4 md:px-6 py-3 md:py-0 border-r md:border-r-0 md:border-b border-neutral-200 dark:border-neutral-800 hidden md:flex transition-colors duration-300">
                <BrainCircuit className="h-6 w-6 text-teal-600 dark:text-teal-400 mr-3 shrink-0" />
                <span className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 text-gradient shrink-0">InvestAI Panel</span>
            </div>
            <div className="flex flex-1 flex-row md:flex-col w-full overflow-x-auto md:overflow-x-hidden md:overflow-y-auto custom-scrollbar items-center md:items-stretch">
                <nav className="flex flex-row md:flex-col md:space-y-1 px-2 py-2 md:px-3 md:py-4 space-x-2 md:space-x-0">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    isActive
                                        ? "bg-teal-50 dark:bg-neutral-900 text-teal-700 dark:text-teal-400"
                                        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 hover:text-neutral-900 dark:hover:text-white",
                                    "group flex flex-col md:flex-row items-center justify-center md:justify-start rounded-lg px-3 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors md:w-auto shrink-0"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        isActive ? "text-teal-600 dark:text-teal-400" : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300",
                                        "mb-1 md:mb-0 md:mr-3 h-5 w-5 shrink-0 transition-colors"
                                    )}
                                    aria-hidden="true"
                                />
                                <span className="block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="md:mt-auto border-l md:border-l-0 md:border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 md:p-3 flex shrink-0 items-center justify-center transition-colors duration-300">
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="group flex flex-col md:flex-row items-center justify-center md:justify-start rounded-lg px-3 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors md:w-auto shrink-0 text-neutral-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-neutral-900/50 hover:text-red-700 dark:hover:text-red-400"
                    >
                        <LogOut className="mb-1 md:mb-0 md:mr-3 h-5 w-5 shrink-0 transition-colors text-neutral-400 dark:text-neutral-500 group-hover:text-red-600 dark:group-hover:text-red-400" aria-hidden="true" />
                        <span className="block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap">Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
