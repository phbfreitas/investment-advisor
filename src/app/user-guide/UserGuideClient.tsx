"use client";

import { useState, useRef, useEffect } from "react";
import {
    ChevronRight,
    Info,
    Target,
    LayoutDashboard,
    Wallet,
    BrainCircuit,
    Users,
    Download,
    Share2,
    Maximize2,
    BookOpen
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const sections = [
    {
        id: "getting-started",
        title: "Getting Started",
        icon: BookOpen,
        subsections: [
            { id: "what-is-investai", title: "What is InvestAI?" },
            { id: "core-concept", title: "The Data-to-Intelligence Loop" },
        ]
    },
    {
        id: "portfolio-management",
        title: "Portfolio Management",
        icon: LayoutDashboard,
        subsections: [
            { id: "dashboard-overview", title: "Dashboard Overview" },
            { id: "adding-assets", title: "Adding & Updating Assets" },
        ]
    },
    {
        id: "finance-summary",
        title: "Finance & Net Worth",
        icon: Wallet,
        subsections: [
            { id: "cashflow-tracking", title: "Monthly Cashflow Tracking" },
            { id: "personal-wealth", title: "Building Net Worth" },
        ]
    },
    {
        id: "ai-intelligence",
        title: "AI Guidance",
        icon: Target,
        subsections: [
            { id: "ai-directives", title: "AI Directives Explained" },
            { id: "the-4-pillar-analysis", title: "The 4-Pillar Evaluation" },
        ]
    },
    {
        id: "collaboration",
        title: "Household Collaboration",
        icon: Users,
        subsections: [
            { id: "managing-members", title: "Managing Household Members" },
        ]
    },
];

export default function UserGuideClient() {
    const [activeSection, setActiveSection] = useState("what-is-investai");
    const contentRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        contentRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-white dark:bg-[#050505] transition-colors duration-300">

            {/* Secondary Sidebar (Documentation Nav) */}
            <aside className="w-full md:w-72 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/50 dark:bg-[#080808]">
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">User Guide</h2>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {sections.map((section) => (
                        <div key={section.id} className="space-y-1">
                            <div className="flex items-center space-x-2 px-2 py-1 text-neutral-900 dark:text-neutral-100 font-medium text-sm">
                                <section.icon className="h-4 w-4 text-teal-600" />
                                <span>{section.title}</span>
                            </div>
                            <div className="space-y-0.5 ml-6 border-l border-neutral-200 dark:border-neutral-800">
                                {section.subsections.map((sub) => (
                                    <button
                                        key={sub.id}
                                        onClick={() => scrollToSection(sub.id)}
                                        className={cn(
                                            "w-full text-left px-4 py-1.5 text-sm transition-colors block border-l -ml-px",
                                            activeSection === sub.id
                                                ? "border-teal-500 text-teal-600 font-medium bg-teal-50/50 dark:bg-teal-900/10"
                                                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
                                        )}
                                    >
                                        {sub.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar md:p-12 p-6">
                <div className="max-w-4xl mx-auto space-y-16 pb-24">

                    {/* Breadcrumbs & Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <nav className="flex items-center space-x-2 text-sm text-neutral-500">
                            <span className="hover:text-teal-600 cursor-pointer">Documentation</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-neutral-900 dark:text-neutral-200 font-medium">User Guide</span>
                        </nav>
                        <div className="flex items-center space-x-2">
                            <button className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
                                <Download className="h-4 w-4 text-neutral-500" />
                            </button>
                            <button className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
                                <Share2 className="h-4 w-4 text-neutral-500" />
                            </button>
                        </div>
                    </div>

                    {/* Intro Section */}
                    <section id="what-is-investai" ref={el => { contentRefs.current["what-is-investai"] = el; }} className="space-y-6">
                        <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">What is InvestAI?</h1>
                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            InvestAI is a high-performance wealth management platform built for individuals and households who demand professional-grade financial intelligence.
                            By merging your personal financial data with cutting-edge AI reasoning, we transform static numbers into actionable "Executive Crispy" investment strategies.
                        </p>

                        <div className="bg-teal-50 border border-teal-100 dark:bg-teal-900/10 dark:border-teal-900/20 rounded-xl p-6 flex items-start space-x-4">
                            <Info className="h-6 w-6 text-teal-600 mt-1 shrink-0" />
                            <div>
                                <h4 className="font-semibold text-teal-900 dark:text-teal-400">Note</h4>
                                <p className="text-teal-800/80 dark:text-teal-300/70 text-sm leading-relaxed">
                                    InvestAI is not a financial brokerage. We provide the intelligence layer; your actual trades and capital remain with your existing banks and brokers.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section id="core-concept" ref={el => { contentRefs.current["core-concept"] = el; }} className="space-y-6">
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">The Data-to-Intelligence Loop</h2>
                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            Our AI operates on a feedback loop. Every ticker you add, every budget item you track, and every goal you set refined the AI's internal model of your wealth.
                            This ensures that when you ask for guidance, it's not generic advice—it's intelligence tailored to <strong>your</strong> strategy.
                        </p>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800" />

                    {/* Dashboard Section */}
                    <section id="dashboard-overview" ref={el => { contentRefs.current["dashboard-overview"] = el; }} className="space-y-6">
                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Dashboard Overview</h2>
                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            The Dashboard is where you track your equities, ETFs, and overall portfolio performance. It converts raw ticker data into visual metrics like total yield and market value.
                        </p>
                        <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl group">
                            <img
                                src="/docs/screenshots/dashboard.png"
                                alt="Dashboard Screenshot"
                                className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                            <div className="absolute bottom-4 right-4 animate-pulse">
                                <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium flex items-center">
                                    <Maximize2 className="h-3 w-3 mr-2" /> Live Dashboard View
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Finance Section */}
                    <section id="cashflow-tracking" ref={el => { contentRefs.current["cashflow-tracking"] = el; }} className="space-y-6">
                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Finance & Cashflow Tracking</h2>
                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            A professional investment strategy requires a robust cashflow foundation. In the Finance Summary, you track your monthly savings which the AI uses to suggest deployment amounts.
                        </p>
                        <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl group">
                            <img
                                src="/docs/screenshots/finance.png"
                                alt="Finance Summary Screenshot"
                                className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/5 p-8 flex flex-col justify-end">
                                <div className="bg-teal-600/90 text-white p-4 rounded-xl max-w-sm backdrop-blur-sm translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <h4 className="font-bold mb-1 italic">CIO Pro-Tip:</h4>
                                    <p className="text-sm opacity-90 italic">Keep your 'Net Savings' accurate. The AI uses this figure to determine if your portfolio is 'under-funded' for your long-term goals.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* AI Strategy Section */}
                    <section id="ai-directives" ref={el => { contentRefs.current["ai-directives"] = el; }} className="space-y-6">
                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">AI Intelligence & Guidance</h2>
                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            The AI Guidance engine is accessible via "Directives." Each directive triggers a specialized reasoning path.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-teal-600 italic">## The Executive Report</h3>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed italic border-l-2 border-teal-500 pl-4">
                                    "I identified a 3.5% drift in your growth-to-income ratio. To maintain your strategy, halt DRIP on HYLD and rotate $1,200 of capital into VFV."
                                </p>
                                <p className="text-neutral-500 text-sm">
                                    This is an example of an actionable AI output. It uses your strategy text to define the rebalancing threshold.
                                </p>
                            </div>
                            <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-lg">
                                <img src="/docs/screenshots/guidance.png" alt="AI Guidance Screenshot" className="w-full h-auto" />
                            </div>
                        </div>
                    </section>

                    {/* Profile Section */}
                    <section id="the-4-pillar-analysis" ref={el => { contentRefs.current["the-4-pillar-analysis"] = el; }} className="space-y-6">
                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">The Strategic Profile</h2>
                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            The Profile page is where you define your Risk Tolerance and Strategy. This is the most important "context" you provide to the platform.
                        </p>
                        <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-xl group">
                            <img
                                src="/docs/screenshots/profile.png"
                                alt="Profile Screenshot"
                                className="w-full h-auto"
                            />
                        </div>
                    </section>

                    {/* Footer Navigation */}
                    <div className="pt-12 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Previous</span>
                            <span className="text-teal-600 font-medium cursor-pointer flex items-center group">
                                <ChevronRight className="h-4 w-4 rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" />
                                Dashboard Overview
                            </span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Next</span>
                            <span className="text-teal-600 font-medium cursor-pointer flex items-center justify-end group">
                                AI Directives
                                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
