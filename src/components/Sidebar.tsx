"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, Settings, BrainCircuit, LogOut, Wallet, Target, BookOpen, Globe, Shield, Radio, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

type PillarId = "blueprint" | "intelligence";

const pillars = [
    {
        id: "blueprint" as PillarId,
        name: "My Blueprint",
        icon: Shield,
        items: [
            { name: "My Investment Strategy", href: "/profile", icon: BrainCircuit },
            { name: "My Finance Summary", href: "/finance-summary", icon: Wallet },
            { name: "My Investment Portfolio", href: "/dashboard", icon: LayoutDashboard },
        ],
    },
    {
        id: "intelligence" as PillarId,
        name: "Market Intelligence",
        icon: Radio,
        items: [
            { name: "Expert Guidance", href: "/", icon: Users },
            { name: "AI Guidance", href: "/profile/guidance", icon: Target },
            { name: "Global News Guidance", href: "/global-radar", icon: Globe },
        ],
    },
];

const utilities = [
    { name: "User Guide", href: "/user-guide", icon: BookOpen },
    { name: "Settings", href: "/settings", icon: Settings },
];

function getPillarForRoute(pathname: string): PillarId {
    const intelligenceRoutes = ["/", "/profile/guidance", "/global-radar"];
    const isIntelligence = intelligenceRoutes.some(
        route => route === "/" ? pathname === "/" : pathname.startsWith(route)
    );
    return isIntelligence ? "intelligence" : "blueprint";
}

export function Sidebar() {
    const pathname = usePathname();
    const [activePillar, setActivePillar] = useState<PillarId>(() => getPillarForRoute(pathname));
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const pillarForRoute = getPillarForRoute(pathname);
        const allPillarRoutes = pillars.flatMap(p => p.items.map(i => i.href));
        if (allPillarRoutes.some(route => route === "/" ? pathname === "/" : pathname.startsWith(route))) {
            setActivePillar(pillarForRoute);
        }
    }, [pathname]);

    const currentPillar = pillars.find(p => p.id === activePillar)!;
    const isAmber = activePillar === "intelligence";

    return (
        <div className={cn(
            "flex fixed bottom-0 left-0 right-0 z-50 md:relative md:h-full w-full flex-row md:flex-col bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md md:bg-neutral-50 dark:md:bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-neutral-200 dark:border-neutral-800 shrink-0 transition-colors duration-300 md:transition-[width] md:duration-200",
            isCollapsed ? "md:w-16" : "md:w-64"
        )}>
            {/* Desktop header */}
            <div className={cn(
                "md:h-16 shrink-0 items-center px-4 md:px-6 py-3 md:py-0 border-r md:border-r-0 md:border-b border-neutral-200 dark:border-neutral-800 hidden md:flex transition-colors duration-300",
                isCollapsed ? "md:justify-center" : "md:justify-between"
            )}>
                <div className={cn("flex items-center min-w-0", isCollapsed && "md:hidden")}>
                    <BrainCircuit className="h-6 w-6 text-teal-600 dark:text-teal-400 mr-3 shrink-0" />
                    <span className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 text-gradient shrink-0">InvestAI Panel</span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsCollapsed(c => !c)}
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-expanded={!isCollapsed}
                    className="hidden md:flex items-center justify-center h-6 w-6 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    )}
                </button>
            </div>

            {/* Desktop pillar toggle */}
            <div className={cn(
                "hidden md:flex mx-3 mt-3 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800",
                isCollapsed && "md:flex-col"
            )}>
                {pillars.map((pillar) => (
                    <button
                        key={pillar.id}
                        onClick={() => setActivePillar(pillar.id)}
                        title={pillar.name}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all",
                            activePillar === pillar.id
                                ? pillar.id === "blueprint"
                                    ? "bg-teal-600 text-white shadow-sm"
                                    : "bg-amber-600 text-white shadow-sm"
                                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                    >
                        <pillar.icon className={cn(isCollapsed ? "h-4 w-4" : "h-3.5 w-3.5")} />
                        <span className={cn(isCollapsed && "hidden")}>{pillar.name}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-1 flex-row md:flex-col w-full overflow-x-auto md:overflow-x-hidden md:overflow-y-auto custom-scrollbar items-center md:items-stretch">
                {/* Mobile pillar toggle */}
                <div className="flex md:hidden flex-col items-center gap-1 px-1 py-2 border-r border-neutral-200 dark:border-neutral-800 shrink-0">
                    {pillars.map((pillar) => (
                        <button
                            key={pillar.id}
                            onClick={() => setActivePillar(pillar.id)}
                            title={pillar.name}
                            className={cn(
                                "p-2 rounded-md transition-all",
                                activePillar === pillar.id
                                    ? pillar.id === "blueprint"
                                        ? "bg-teal-600 text-white"
                                        : "bg-amber-600 text-white"
                                    : "text-neutral-400"
                            )}
                        >
                            <pillar.icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>

                {/* Navigation items */}
                <nav className="flex flex-row md:flex-col md:space-y-1 px-2 py-2 md:px-3 md:py-4 space-x-2 md:space-x-0">
                    {[...currentPillar.items, ...utilities].map((item) => {
                        const isActive = pathname === item.href;
                        const isUtility = utilities.some(u => u.href === item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                title={item.name}
                                className={cn(
                                    isActive
                                        ? isAmber && !isUtility
                                            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                                            : "bg-teal-50 dark:bg-neutral-900 text-teal-700 dark:text-teal-400"
                                        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 hover:text-neutral-900 dark:hover:text-white",
                                    isUtility ? "md:hidden" : "",
                                    "group flex flex-col md:flex-row items-center justify-center rounded-lg px-3 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors md:w-auto shrink-0",
                                    isCollapsed ? "md:justify-center" : "md:justify-start"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        isActive
                                            ? isAmber && !isUtility
                                                ? "text-amber-600 dark:text-amber-400"
                                                : "text-teal-600 dark:text-teal-400"
                                            : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300",
                                        "mb-1 h-5 w-5 shrink-0 transition-colors",
                                        isCollapsed ? "md:mb-0 md:mr-0" : "md:mb-0 md:mr-3"
                                    )}
                                    aria-hidden="true"
                                />
                                <span className={cn(
                                    "block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap",
                                    isCollapsed && "md:hidden"
                                )}>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Utilities separator + items (desktop only) */}
                <div className="hidden md:block border-t border-neutral-200 dark:border-neutral-800 mx-3 mt-2" />
                <nav className="hidden md:flex md:flex-col md:space-y-1 md:px-3 md:py-2">
                    {utilities.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                title={item.name}
                                className={cn(
                                    isActive
                                        ? "bg-teal-50 dark:bg-neutral-900 text-teal-700 dark:text-teal-400"
                                        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 hover:text-neutral-900 dark:hover:text-white",
                                    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    isCollapsed ? "justify-center" : ""
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        isActive ? "text-teal-600 dark:text-teal-400" : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300",
                                        "h-5 w-5 shrink-0 transition-colors",
                                        isCollapsed ? "mr-0" : "mr-3"
                                    )}
                                    aria-hidden="true"
                                />
                                <span className={cn("whitespace-nowrap", isCollapsed && "hidden")}>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Sign out */}
                <div className="md:mt-auto border-l md:border-l-0 md:border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 md:p-3 flex shrink-0 items-center justify-center transition-colors duration-300">
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        title="Sign Out"
                        className={cn(
                            "group flex flex-col md:flex-row items-center justify-center rounded-lg px-3 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors md:w-auto shrink-0 text-neutral-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-neutral-900/50 hover:text-red-700 dark:hover:text-red-400",
                            isCollapsed ? "md:justify-center" : "md:justify-start"
                        )}
                    >
                        <LogOut className={cn(
                            "mb-1 h-5 w-5 shrink-0 transition-colors text-neutral-400 dark:text-neutral-500 group-hover:text-red-600 dark:group-hover:text-red-400",
                            isCollapsed ? "md:mb-0 md:mr-0" : "md:mb-0 md:mr-3"
                        )} aria-hidden="true" />
                        <span className={cn(
                            "block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap",
                            isCollapsed && "md:hidden"
                        )}>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
