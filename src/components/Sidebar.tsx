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
        <div className="flex h-full w-64 flex-col bg-[#0a0a0a] border-r border-neutral-800">
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-neutral-800">
                <BrainCircuit className="h-6 w-6 text-teal-400 mr-3" />
                <span className="text-lg font-semibold tracking-tight text-neutral-100 text-gradient">InvestAI Panel</span>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">
                <nav className="flex-1 space-y-1 px-3 py-4">
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
                                        "mr-3 h-5 w-5 shrink-0 transition-colors"
                                    )}
                                    aria-hidden="true"
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
