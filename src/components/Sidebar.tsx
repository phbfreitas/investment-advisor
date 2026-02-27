"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, Settings, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Warren Buffett", href: "/", icon: Users },
    { name: "KPI Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Financial Brain", href: "/profile", icon: BrainCircuit },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex z-20 md:h-full w-full md:w-64 flex-row md:flex-col bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-neutral-800 shrink-0">
            <div className="flex md:h-16 shrink-0 items-center px-4 md:px-6 py-3 md:py-0 border-r md:border-r-0 md:border-b border-neutral-800 hidden md:flex">
                <BrainCircuit className="h-6 w-6 text-teal-400 mr-3 shrink-0" />
                <span className="text-lg font-semibold tracking-tight text-neutral-100 text-gradient shrink-0">InvestAI Panel</span>
            </div>
            <div className="flex flex-1 flex-row md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar">
                <nav className="flex-1 flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-1 px-3 py-2 md:py-4 min-w-max md:min-w-0">
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
                                    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        isActive ? "text-teal-400" : "text-neutral-500 group-hover:text-neutral-300",
                                        "mr-0 md:mr-3 h-5 w-5 shrink-0 transition-colors"
                                    )}
                                    aria-hidden="true"
                                />
                                <span className="hidden md:block ml-3 md:ml-0">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
