"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, Settings, BrainCircuit, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const navigation = [
    { name: "Warren Buffett", href: "/", icon: Users },
    { name: "KPI Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Financial Brain", href: "/profile", icon: BrainCircuit },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex fixed bottom-0 left-0 right-0 z-50 md:relative md:h-full w-full md:w-64 flex-row md:flex-col bg-[#0a0a0a]/95 backdrop-blur-md md:bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-neutral-800 shrink-0">
            <div className="md:h-16 shrink-0 items-center px-4 md:px-6 py-3 md:py-0 border-r md:border-r-0 md:border-b border-neutral-800 hidden md:flex">
                <BrainCircuit className="h-6 w-6 text-teal-400 mr-3 shrink-0" />
                <span className="text-lg font-semibold tracking-tight text-neutral-100 text-gradient shrink-0">InvestAI Panel</span>
            </div>
            <div className="flex flex-1 flex-row md:flex-col w-full md:overflow-y-auto custom-scrollbar">
                <nav className="flex-1 flex flex-row justify-around md:flex-col md:space-y-1 px-1 py-2 md:px-3 md:py-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    isActive
                                        ? "bg-neutral-900 text-teal-400"
                                        : "text-neutral-400 hover:bg-neutral-900/50 hover:text-white",
                                    "group flex flex-col md:flex-row items-center justify-center md:justify-start rounded-lg px-2 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors w-full md:w-auto"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        isActive ? "text-teal-400" : "text-neutral-500 group-hover:text-neutral-300",
                                        "mb-1 md:mb-0 md:mr-3 h-5 w-5 md:h-5 md:w-5 shrink-0 transition-colors"
                                    )}
                                    aria-hidden="true"
                                />
                                <span className="block text-[10px] md:text-sm text-center md:text-left truncate w-full md:w-auto overflow-hidden">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="md:mt-auto border-l md:border-l-0 md:border-t border-neutral-800 p-1 md:p-3 flex shrink-0 items-center justify-center">
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="group flex flex-col md:flex-row items-center justify-center md:justify-start rounded-lg px-2 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors w-full md:w-auto text-neutral-400 hover:bg-neutral-900/50 hover:text-red-400"
                    >
                        <LogOut className="mb-1 md:mb-0 md:mr-3 h-5 w-5 md:h-5 md:w-5 shrink-0 transition-colors text-neutral-500 group-hover:text-red-400" aria-hidden="true" />
                        <span className="block text-[10px] md:text-sm text-center md:text-left truncate w-full md:w-auto overflow-hidden">Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
