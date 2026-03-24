"use client";

import { useState, useRef } from "react";
import {
    ChevronRight,
    Users,
    LayoutDashboard,
    Wallet,
    BrainCircuit,
    Target,
    Settings,
    Code,
    Zap,
    Info,
    LineChart,
    Globe,
    Shield,
    Radio
} from "lucide-react";
import { cn } from "@/lib/utils";

type SectionItem = {
    id: string;
    title: string;
    icon: typeof Info;
    subsections: { id: string; title: string }[];
};

type PillarGroup = {
    pillar: string;
    pillarIcon: typeof Shield;
    pillarAccent: string;
    items: SectionItem[];
};

const sectionGroups: (SectionItem | PillarGroup)[] = [
    {
        id: "intro-john",
        title: "Introduction",
        icon: Info,
        subsections: []
    },
    {
        pillar: "My Blueprint",
        pillarIcon: Shield,
        pillarAccent: "text-teal-600 dark:text-teal-400",
        items: [
            {
                id: "strategy-profile",
                title: "1. My Investment Strategy",
                icon: BrainCircuit,
                subsections: [
                    { id: "strat-logic", title: "The Steering Wheel" },
                    { id: "strat-ripple", title: "Dynamic Rewiring" },
                ]
            },
            {
                id: "finance-summary",
                title: "2. My Finance Summary",
                icon: Wallet,
                subsections: [
                    { id: "fin-logic", title: "Cashflow Mathematics" },
                    { id: "fin-ripple", title: "The Ultimate Metric" },
                ]
            },
            {
                id: "portfolio",
                title: "3. My Investment Portfolio",
                icon: LayoutDashboard,
                subsections: [
                    { id: "port-logic", title: "Mathematical Logic" },
                    { id: "port-dividends", title: "Dividend Summary" },
                    { id: "port-ripple", title: "Cascading Effects" },
                ]
            },
        ]
    },
    {
        pillar: "Market Intelligence",
        pillarIcon: Radio,
        pillarAccent: "text-amber-600 dark:text-amber-400",
        items: [
            {
                id: "advisory-board",
                title: "4. Expert Guidance",
                icon: Users,
                subsections: [
                    { id: "ab-logic", title: "Logic Mapping" },
                    { id: "ab-memory", title: "Advisor Notebook" },
                    { id: "ab-ripple", title: " Ripple Effect" },
                ]
            },
            {
                id: "ai-guidance",
                title: "5. AI Guidance",
                icon: Target,
                subsections: [
                    { id: "ai-logic", title: "The Data Assembly Line" },
                    { id: "ai-ripple", title: "The 4-Pillar Test" },
                ]
            },
            {
                id: "global-radar",
                title: "6. Global News Guidance",
                icon: Globe,
                subsections: [
                    { id: "radar-logic", title: "The Intelligence Pipeline" },
                    { id: "radar-ripple", title: "The Deep Critique" },
                ]
            },
        ]
    },
    {
        id: "settings",
        title: "7. Settings",
        icon: Settings,
        subsections: [
            { id: "set-logic", title: "Household Isolation" },
            { id: "set-ripple", title: "Instant Synchronization" },
        ]
    },
];

export default function UserGuideClient() {
    const [activeSection, setActiveSection] = useState("intro-john");
    const contentRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    const scrollToSection = (id: string, parentId?: string) => {
        setActiveSection(parentId || id);
        contentRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-white dark:bg-[#050505] transition-colors duration-300">

            {/* Internal Navigation Sidebar */}
            <aside className="w-full md:w-72 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/50 dark:bg-[#080808]">
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Logic Manual</h2>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {sectionGroups.map((group) => {
                        if ("pillar" in group) {
                            const PillarIcon = group.pillarIcon;
                            return (
                                <div key={group.pillar} className="space-y-1">
                                    <div className={cn("flex items-center space-x-2 px-2 pt-3 pb-1 text-xs font-bold uppercase tracking-wider", group.pillarAccent)}>
                                        <PillarIcon className="h-3.5 w-3.5" />
                                        <span>{group.pillar}</span>
                                    </div>
                                    {group.items.map((section) => (
                                        <div key={section.id} className="space-y-1">
                                            <button
                                                onClick={() => scrollToSection(section.id)}
                                                className={cn(
                                                    "flex items-center space-x-2 w-full text-left px-2 py-2 rounded-lg transition-colors font-medium text-sm",
                                                    activeSection === section.id
                                                        ? "bg-teal-50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400"
                                                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                                )}
                                            >
                                                <section.icon className={cn("h-4 w-4", activeSection === section.id ? "text-teal-600" : "text-neutral-500")} />
                                                <span>{section.title}</span>
                                            </button>
                                            {section.subsections.length > 0 && (
                                                <div className="space-y-0.5 ml-6 border-l border-neutral-200 dark:border-neutral-800 mt-1">
                                                    {section.subsections.map((sub) => (
                                                        <button
                                                            key={sub.id}
                                                            onClick={() => scrollToSection(sub.id, section.id)}
                                                            className="w-full text-left px-4 py-1.5 text-sm transition-colors block border-l -ml-px border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
                                                        >
                                                            {sub.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                        const section = group as SectionItem;
                        return (
                            <div key={section.id} className="space-y-1">
                                <button
                                    onClick={() => scrollToSection(section.id)}
                                    className={cn(
                                        "flex items-center space-x-2 w-full text-left px-2 py-2 rounded-lg transition-colors font-medium text-sm",
                                        activeSection === section.id
                                            ? "bg-teal-50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400"
                                            : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                    )}
                                >
                                    <section.icon className={cn("h-4 w-4", activeSection === section.id ? "text-teal-600" : "text-neutral-500")} />
                                    <span>{section.title}</span>
                                </button>
                                {section.subsections.length > 0 && (
                                    <div className="space-y-0.5 ml-6 border-l border-neutral-200 dark:border-neutral-800 mt-1">
                                        {section.subsections.map((sub) => (
                                            <button
                                                key={sub.id}
                                                onClick={() => scrollToSection(sub.id, section.id)}
                                                className="w-full text-left px-4 py-1.5 text-sm transition-colors block border-l -ml-px border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
                                            >
                                                {sub.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar md:p-12 p-6 scroll-smooth">
                <div className="max-w-4xl mx-auto space-y-20 pb-32">

                    {/* Intro & Hero Section */}
                    <section id="intro-john" ref={el => { contentRefs.current["intro-john"] = el; }} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-4">
                                System Logic & Ripple Effect Manual
                            </h1>
                            <p className="text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-3xl">
                                A definitive backend-to-business translation manual. The platform is organized into two pillars: <strong className="text-teal-700 dark:text-teal-400">My Blueprint</strong> (your private financial vault) and <strong className="text-amber-700 dark:text-amber-400">Market Intelligence</strong> (AI-driven guidance and live data).
                            </p>
                        </div>

                        {/* Narrative Hero Card */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/50 via-white to-teal-50/50 dark:from-indigo-950/20 dark:via-neutral-900 dark:to-teal-900/20 border border-neutral-200 dark:border-neutral-800 shadow-xl dark:shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-400/10 dark:bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

                            <div className="relative p-8 md:p-10">
                                <div className="flex items-center space-x-3 mb-6">
                                    <div className="h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-bold backdrop-blur-sm shadow-sm ring-1 ring-teal-500/20">
                                        J
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Meet our Example User: John</h3>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">To make assimilation easy, we follow a single running example.</p>
                                    </div>
                                </div>
                                <div className="bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-xl p-6 border border-white/20 dark:border-white/5 shadow-inner">
                                    <p className="text-neutral-700 dark:text-neutral-300 font-medium text-lg leading-relaxed italic">
                                        "John is a 55-year-old preparing for retirement. He has a $100,000 stock portfolio and keeps $15,000 in cash reserves. He just logged into the app."
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Navigation Pillars Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                            <div className="rounded-xl border border-teal-200 dark:border-teal-800/50 bg-teal-50/50 dark:bg-teal-900/10 p-6">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                    <h3 className="font-bold text-teal-900 dark:text-teal-400">My Blueprint</h3>
                                </div>
                                <p className="text-sm text-teal-800 dark:text-teal-300/80 mb-3">Your private vault — all static and dynamic data about your financial situation.</p>
                                <ul className="text-sm text-teal-700 dark:text-teal-300/70 space-y-1">
                                    <li>1. My Investment Strategy</li>
                                    <li>2. My Finance Summary</li>
                                    <li>3. My Investment Portfolio</li>
                                </ul>
                            </div>
                            <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-6">
                                <div className="flex items-center space-x-2 mb-3">
                                    <Radio className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    <h3 className="font-bold text-amber-900 dark:text-amber-400">Market Intelligence</h3>
                                </div>
                                <p className="text-sm text-amber-800 dark:text-amber-300/80 mb-3">The live engine — three distinct voices providing active guidance and external data.</p>
                                <ul className="text-sm text-amber-700 dark:text-amber-300/70 space-y-1">
                                    <li>4. Expert Guidance</li>
                                    <li>5. AI Guidance</li>
                                    <li>6. Global News Guidance</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 4: Expert Guidance */}
                    <section id="advisory-board" ref={el => { contentRefs.current["advisory-board"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <Users className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">4. Expert Guidance (Chat Engine)</h2>
                        </div>



                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            This is the homepage of the app, featuring a panel of legendary investors — John C. Bogle, Warren Buffett, Luiz Barsi, Benjamin Graham, Max Gunther, Morgan Housel, and Robert Kiyosaki. Select which advisors to consult using the collapsible chip selector — your selected advisors appear as compact chips, and clicking &quot;Change&quot; opens a responsive grid to toggle advisors on or off. Each advisor brings a distinct investment philosophy. Unlike a generic AI, this engine pulls your real, live financial data <em>before</em> it answers you.
                        </p>

                        <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 my-6">
                            <h4 className="font-bold text-neutral-900 dark:text-white mb-4">Prompt Templates (Pill Buttons):</h4>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                Each advisor card displays four built-in prompt templates as pill buttons in the chat area. Clicking any pill instantly populates the chat input with a fully engineered prompt tailored for that advisor&apos;s philosophy.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                    <LineChart className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Investment Suggestions</span>
                                </div>
                                <div className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                    <BrainCircuit className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Financial Analysis</span>
                                </div>
                                <div className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                    <Target className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Portfolio Rebalancing</span>
                                </div>
                                <div className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                    <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Financial Health Audit</span>
                                </div>
                            </div>
                        </div>

                        <div id="ab-logic" ref={el => { contentRefs.current["ab-logic"] = el; }} className="space-y-4">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <BrainCircuit className="h-5 w-5 mr-2 text-indigo-500" /> How it Thinks (Logic Mapping)
                            </h3>
                            <ul className="space-y-4 text-neutral-600 dark:text-neutral-400 ml-2 border-l-2 border-neutral-200 dark:border-neutral-800 pl-6 py-2">
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Context Harvesting</strong>
                                    Before the AI sees your typed question, it builds a comprehensive &quot;Context String&quot; by gathering <em>all</em> of your data: your Investment Strategy configuration (asset mix, philosophies, sector/geographic targets, risk tolerance), your full Finance Summary (monthly budget, income/expenses, wealth, liabilities, net worth), and your complete Portfolio Holdings (every position with market value, P/L, yield, beta, sector, analyst consensus, and more).
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Dynamic Prompting</strong>
                                    It pastes all these numbers into the invisible instructions given to the AI.
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Tool Calling</strong>
                                    Only <em>then</em> does it give the AI the question, along with a hidden tool to fetch real-time stock prices (via Yahoo Finance) if you mention a specific company.
                                </li>
                            </ul>
                        </div>

                        <div id="ab-memory" ref={el => { contentRefs.current["ab-memory"] = el; }} className="space-y-4">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <BrainCircuit className="h-5 w-5 mr-2 text-teal-500" /> Advisor Notebook (EA Memory)
                            </h3>
                            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                Your advisors build <strong className="text-neutral-900 dark:text-white">per-advisor structured memory</strong>, surfaced as a persistent <strong className="text-neutral-900 dark:text-white">Advisor Notebook</strong> sidebar. Each guru develops their own independent understanding of your investment profile — Buffett doesn&apos;t see what Housel discussed.
                            </p>
                            <ul className="space-y-4 text-neutral-600 dark:text-neutral-400 ml-2 border-l-2 border-neutral-200 dark:border-neutral-800 pl-6 py-2">
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Our Journey So Far</strong>
                                    The centerpiece of each advisor&apos;s notebook is a warm, narrative summary of your conversations together — covering key topics discussed, how your thinking has evolved, and the trajectory of your investment journey with that advisor. It reads like an advisor recounting their relationship with you.
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Structured Section Cards</strong>
                                    Below the narrative, each advisor&apos;s memory is organized into 5 sections: <em>Investment Thesis</em>, <em>Current Asset Focus</em>, <em>Risk Parameters</em>, <em>Active Dilemmas</em>, and <em>Key Decisions</em>. These display as glassmorphic cards in the sidebar, giving you instant visibility into what each guru knows about you.
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Two-Column Executive Board</strong>
                                    On desktop, the Advisory Board uses a two-column layout — the Advisor Notebook on the left (300px), your active conversation on the right. On mobile, the Notebook opens as a slide-out drawer via the &quot;Notebook&quot; button in the header.
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Progress Indicator</strong>
                                    For advisors you&apos;ve started chatting with but haven&apos;t reached the memory threshold yet (3 exchanges), a progress bar shows how close you are to generating their first notebook entry.
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Transcript Archive</strong>
                                    A &quot;View Transcript Archive&quot; link in the Notebook opens a date-grouped modal showing all past exchanges. Each day&apos;s conversations are expandable to see the full advisor responses — keeping the main board clean while preserving full audit capability.
                                </li>
                                <li className="relative">
                                    <div className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-white dark:ring-[#050505]"></div>
                                    <strong className="text-neutral-900 dark:text-white block mb-1">Memory Control</strong>
                                    Reset a single advisor&apos;s memory independently, or reset all advisors at once from the Notebook footer. Chat history auto-cleans after 180 days. Advisors naturally reference past decisions when relevant, but never force references on unrelated questions.
                                </li>
                            </ul>
                            <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                <h4 className="font-bold text-neutral-900 dark:text-white mb-3">Graceful Degradation</h4>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    If the memory system encounters any issue (network error, database timeout), Expert Guidance automatically falls back to its original stateless behavior — your question is still answered, just without historical context. Memory is a seamless enhancement, never a blocker.
                                </p>
                            </div>
                        </div>

                        <div id="ab-ripple" ref={el => { contentRefs.current["ab-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-teal-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-teal-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ripple Effect</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-neutral-700 dark:text-neutral-300">
                                    Let's say John types: <br /><strong className="text-teal-700 dark:text-teal-400 italic text-lg">"Should I buy $20,000 worth of Tesla stock today?"</strong>
                                </p>
                                <ol className="list-decimal list-outside ml-5 space-y-2 text-neutral-600 dark:text-neutral-400">
                                    <li>The AI engine checks John's injected context and sees: <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-sm text-neutral-900 dark:text-neutral-200 font-mono font-medium">CASH RESERVES: $15,000</code>.</li>
                                    <li><strong>The Logic Branch:</strong> The system immediately flags a contradiction. The user is asking to spend $20k, but only has $15k liquid.</li>
                                    <li><strong>The Result:</strong> Instead of analyzing Tesla's P/E ratio, your selected advisors will immediately address the contradiction, each through their own lens: <em className="text-neutral-800 dark:text-neutral-200 block mt-2 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-100 dark:border-neutral-800">"Rule No. 1 is never lose money. You only have $15,000 in cash reserves. Never invest money you don't possess..."</em></li>
                                </ol>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 3: Portfolio */}
                    <section id="portfolio" ref={el => { contentRefs.current["portfolio"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <LayoutDashboard className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">3. My Investment Portfolio</h2>
                        </div>

                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            This section is the mathematical core of your individual holdings and where you manage your day-to-day assets.
                        </p>

                        <div id="port-logic" ref={el => { contentRefs.current["port-logic"] = el; }} className="space-y-6">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <LayoutDashboard className="h-5 w-5 mr-2 text-indigo-500" /> Detailed Features & Functionalities
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
                                        <LineChart className="h-4 w-4 mr-2 text-indigo-500" /> KPI Summary Cards
                                    </h4>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Total Market Value:</strong> Sums the real-time value of every asset you own. Pulls live market data.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Total Return:</strong> Percentage of profit or loss across your entire portfolio based on initial Book Cost.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Avg Dividend Yield:</strong> Computes a weighted average of your dividend yields.</li>
                                    </ul>
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
                                        <LayoutDashboard className="h-4 w-4 mr-2 text-rose-500" /> The Holdings Breakdown Table
                                    </h4>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Sorting & Filtering:</strong> Click column headers to sort; type in filter boxes to isolate specific rows.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Editable Inline Rows:</strong> Click the blue pencil icon to edit asset details inline.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Live Ticker Price:</strong> Auto-fetches live prices from Yahoo Finance when editing a ticker symbol.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Frozen Columns:</strong> Account, Acct Type, Acct #, and Ticker columns stay pinned on the left as you scroll horizontally through the table.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Sticky Header:</strong> Column headers and filter row remain visible as you scroll vertically through your holdings.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Unavailable Data Indicator:</strong> Fields that cannot be auto-calculated from market data (e.g., 3YR Return for individual stocks, Analyst ratings for small-caps) display a muted dash (—) with a tooltip explaining the limitation.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Totals Row:</strong> Auto-sums Total Market Value and Expected Dividends at the bottom.</li>
                                    </ul>
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 md:col-span-2">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
                                        <Code className="h-4 w-4 mr-2 text-teal-500" /> Profile Page: Investment Portfolio Table
                                    </h4>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                                        A dedicated portfolio entry table lives on the My Investment Strategy page, designed for adding and editing holdings with maximum automation:
                                    </p>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Ticker Auto-Lookup:</strong> Type a ticker symbol and the system automatically fetches the current price from Yahoo Finance — no manual price entry required.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Account Name Autofill:</strong> The account name field auto-suggests based on your previously used account names, speeding up data entry.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Auto-Calculated Fields:</strong> Weight % (position size relative to total portfolio), P/L (profit or loss vs. book cost), and Market Value are all computed automatically — you only enter the quantity and book cost.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Totals Row:</strong> The table footer auto-sums market value, book cost, and expected dividends across all entries.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">CSV Export:</strong> Export your entire portfolio to a CSV file with one click for use in spreadsheets or external tools.</li>
                                    </ul>
                                </div>
                                <div id="port-dividends" ref={el => { contentRefs.current["port-dividends"] = el; }} className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 md:col-span-2 scroll-m-8">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
                                        <LineChart className="h-4 w-4 mr-2 text-emerald-500" /> Dividend Summary
                                    </h4>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                                        Below the Holdings Breakdown table, a dedicated Dividend Summary section provides income projections:
                                    </p>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Period Selector:</strong> Toggle between Next Month, 3 Months, 6 Months, or 12 Months to project expected dividend income.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Three KPI Cards:</strong> Shows the expected dividends for the selected period, monthly average, and annual total.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Strategy Breakdown:</strong> Dividends are broken down by Strategy Type (Growth, Dividend, Mix/Hybrid) so you can see which part of your portfolio generates the most income.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div id="port-ripple" ref={el => { contentRefs.current["port-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-teal-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-teal-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ripple Effect</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-neutral-700 dark:text-neutral-300">
                                    John owns 100 shares of Microsoft. The price jumps from $400 to $410. John's <em>Total Market Value</em> in the Holdings Breakdown increases by $1,000.
                                </p>
                                <div className="mt-4 p-4 rounded-lg bg-neutral-100 dark:bg-neutral-900/50 text-sm text-neutral-600 dark:text-neutral-400 italic">
                                    <strong>The Ripple:</strong> This $1,000 increase doesn't just stay on this page—it immediately "ripples" over to the <strong>My Finance Summary</strong> page, instantly increasing John's calculated <code>Net Worth</code> without him typing a single thing.
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 2: Finance Summary */}
                    <section id="finance-summary" ref={el => { contentRefs.current["finance-summary"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <Wallet className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">2. My Finance Summary</h2>
                        </div>

                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            While the Portfolio tracks the stock market, this section tracks your real-life wallet: your salary, expenses, real estate, and liabilities.
                        </p>

                        <div id="fin-logic" ref={el => { contentRefs.current["fin-logic"] = el; }} className="space-y-6">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <Wallet className="h-5 w-5 mr-2 text-indigo-500" /> Detailed Features & Functionalities
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-2">A. Budget Monthly Cashflow</h4>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Income & Expense Inputs:</strong> Enter values for Paycheck, Dividends, Fixed Home, etc. Auto-formats currency.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Auto-Calculated Savings:</strong> Instantly updates Income minus Expenses as you type.</li>
                                    </ul>
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-2">B. Actual Monthly Cash Flow</h4>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Tabular Tracking:</strong> Add rows for Years and Months. Enter actual Income, Expenses, and ending Cash Reserves.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Row Management:</strong> Easily add new rows or remove mistakes with the trashcan icon.</li>
                                    </ul>
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-2">C. Rental Cashflow</h4>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        A dedicated module to isolate income and expenses related to rental properties, calculating an isolated Net Profit / Loss.
                                    </p>
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-2">D. Personal Wealth</h4>
                                    <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2 list-disc list-outside ml-4">
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Asset Integrations:</strong> Enter values for Real Estate, Cash, Cars, and <strong>Other Assets</strong> (a catch-all field for any asset not covered by other categories, such as collectibles, business interests, or personal property).</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Synced Investment Field:</strong> Read-only field pulling Total Market Value directly from the Portfolio page.</li>
                                        <li><strong className="text-neutral-800 dark:text-neutral-200">Net Worth Calculation:</strong> Total Assets minus Total Liabilities, instantly updated and timestamped.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div id="fin-ripple" ref={el => { contentRefs.current["fin-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-teal-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-teal-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ultimate Metric: Net Worth</h3>
                            </div>
                            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                                <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed italic">
                                    "If the stock market crashes (My Investment Portfolio) AND John buys a new car on credit (My Finance Summary expenses), both of these negative actions cascade simultaneously into this one Net Worth number, providing a brutally honest, real-time snapshot of wealth."
                                </p>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 1: Strategy */}
                    <section id="strategy-profile" ref={el => { contentRefs.current["strategy-profile"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <BrainCircuit className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">1. My Investment Strategy</h2>
                        </div>

                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            This page is the <strong>Steering Wheel</strong> for the AI. It combines free-text narrative context with structured strategy configuration, giving advisors both qualitative and quantitative understanding of your investment approach.
                        </p>

                        <div id="strat-logic" ref={el => { contentRefs.current["strat-logic"] = el; }} className="space-y-6">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <BrainCircuit className="h-5 w-5 mr-2 text-indigo-500" /> Detailed Features & Functionalities
                            </h3>

                            <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                <h4 className="font-bold text-neutral-900 dark:text-white mb-4">A. Narrative Context</h4>
                                <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                    <li><strong>Overall Investment Strategy:</strong> A free-text area describing your narrative focus (e.g., &quot;Dividend growth for passive income&quot;). Auto-resizes as you type.</li>
                                    <li><strong>Financial Goals:</strong> Define short term and long term milestones.</li>
                                    <li><strong>Risk Tolerance Slider:</strong> A 1–10 numeric slider replaces the old dropdown. A score of 1 is maximally conservative; 10 is fully speculative. The selected value is passed directly to the AI, allowing it to calibrate advice with finer precision than broad category labels.</li>
                                </ul>
                            </div>

                            <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                <h4 className="font-bold text-neutral-900 dark:text-white mb-4">B. Strategy Configuration (8 Collapsible Sections)</h4>
                                <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                    <li><strong>Asset Mix:</strong> Define Growth / Income / Mixed target percentages (must sum to 100%). A visual stacked bar chart updates in real-time.</li>
                                    <li><strong>Investment Philosophies:</strong> Toggle-select from 11 options grouped by Value-Based (purple), Strategy-Based (teal), and Style-Based (amber).</li>
                                    <li><strong>Core Principles:</strong> Select Diversification, Discipline/Rebalancing, and/or Cost Minimization.</li>
                                    <li><strong>Account Types:</strong> Specify TFSA, RRSP, and/or Non-Registered accounts.</li>
                                    <li><strong>Trading Methodology:</strong> Choose from Buy and Hold, Trend Following, Value Averaging, Sector Rotation, and Swing Trading.</li>
                                    <li><strong>Sector Allocation:</strong> Set target percentages across 11 standard sectors plus two additional options — <strong>S&amp;P 500</strong> (for broad index exposure) and <strong>Other</strong> (for assets that don&apos;t fit a standard sector). Includes an inline <strong>drift table</strong> comparing targets to actuals from your portfolio. Sectors drifting &gt;5% are flagged.</li>
                                    <li><strong>Geographic Exposure:</strong> Set target percentages across geographic regions. Three new regions have been added — <strong>USA Only</strong>, <strong>Canada Only</strong>, and <strong>Global Mix</strong> — alongside existing options (North America, Europe, Asia, Emerging Markets, Frontier Markets). Same drift detection applies.</li>
                                    <li><strong>Performance Targets:</strong> Set Expected Annual Return (%) and Target Monthly Dividend ($). The system projects estimates from your actual holdings and flags when targets exceed reality.</li>
                                </ul>
                            </div>

                            <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                <h4 className="font-bold text-neutral-900 dark:text-white mb-4">C. Validation</h4>
                                <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-disc list-outside ml-4">
                                    <li>All percentage groups must sum to exactly 100% before saving. Real-time &quot;Remaining: X%&quot; indicators turn green/red.</li>
                                    <li>Server-side validation provides a second safety net, returning specific error messages.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="strat-ripple" ref={el => { contentRefs.current["strat-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-teal-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-teal-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ripple Effect: Risk Tolerance + Strategy Config</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-neutral-700 dark:text-neutral-300 text-sm">
                                    Both narrative fields AND structured strategy config are injected into every AI request.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/50 dark:bg-teal-900/10">
                                        <h4 className="font-bold text-teal-900 dark:text-teal-400 mb-2">John: Conservative + Buy and Hold</h4>
                                        <p className="text-sm text-teal-800 dark:text-teal-300/80 leading-relaxed">
                                            The AI ONLY recommends safe, established companies with strong dividends and broad portfolio diversification.
                                        </p>
                                    </div>
                                    <div className="p-6 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/10">
                                        <h4 className="font-bold text-rose-900 dark:text-rose-400 mb-2">John&apos;s son: Aggressive + Swing Trading</h4>
                                        <p className="text-sm text-rose-800 dark:text-rose-300/80 leading-relaxed">
                                            The AI recommends distressed, volatile opportunities for short-term gains, ignoring safe dividend stocks.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 rounded-lg bg-neutral-100 dark:bg-neutral-900/50 text-sm text-neutral-600 dark:text-neutral-400 italic">
                                    <strong>Drift Alert:</strong> If John sets 20% target for Financials but only has 14% actual, the drift table shows -6% with a warning — reminding him to rebalance.
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 5: AI Guidance */}
                    <section id="ai-guidance" ref={el => { contentRefs.current["ai-guidance"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <Target className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">5. AI Guidance</h2>
                        </div>

                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            This is the heavy-duty analytics engine that generates multi-page strategic reports using highly engineered "Directives".
                        </p>

                        <div id="ai-logic" ref={el => { contentRefs.current["ai-logic"] = el; }} className="space-y-6">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <Target className="h-5 w-5 mr-2 text-indigo-500" /> Detailed Features & Functionalities
                            </h3>
                            <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                <p className="text-neutral-700 dark:text-neutral-300 mb-4 font-medium">The page features six targeted AI Directives:</p>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">1.</span> <span><strong>Rebalance with Precision:</strong> Identifies asset allocation drifts.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">2.</span> <span><strong>Optimize Dividend Growth:</strong> Suggests moves to increase cash flow.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">3.</span> <span><strong>Maintain Tactical Aggression:</strong> Highlights 'Buy the Dip' opportunities.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">4.</span> <span><strong>Investment Idea Evaluation:</strong> A rigorous 4-pillar analysis for a specific new asset (requires ticker input).</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">5.</span> <span><strong>Portfolio Report:</strong> Multi-factor analysis highlighting strengths and weaknesses.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">6.</span> <span><strong>Stock Recommendations:</strong> Agent recommendations based on expert opinions.</span></li>
                                </ul>
                                <div className="mt-6 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
                                    <div>
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Live Streaming Interface:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">When a report is triggered, an elegant modal opens, and the AI's response is streamed live to the screen, formatted in rich Markdown (tables, bold text, lists) for immediate readability.</span>
                                    </div>
                                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Intelligent Caching:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">To maximize speed and minimize API costs, the system caches every generated report. If you open a previously generated directive, it will load instantly exactly as it was.</span>
                                    </div>
                                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Stale Data Warnings:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400 block mb-3">The system takes a fingerprint snapshot of your Portfolio and Strategy whenever an analysis is generated. If you change your holdings or risk tolerance and then open a cached report, you will be greeted by an Amber Warning Banner explicitly listing which underlying data fields have changed since the last run.</span>
                                        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
                                            <strong className="text-xs text-amber-900 dark:text-amber-400 uppercase tracking-wider block mb-2 flex items-center"><Zap className="h-3 w-3 mr-1" /> Monitored Fields (Triggers Stale Warning)</strong>
                                            <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1.5 list-none">
                                                <li className="flex items-center"><ChevronRight className="h-3 w-3 text-amber-500 mr-1 shrink-0" /> Investment Strategy</li>
                                                <li className="flex items-center"><ChevronRight className="h-3 w-3 text-amber-500 mr-1 shrink-0" /> Financial Goals</li>
                                                <li className="flex items-center"><ChevronRight className="h-3 w-3 text-amber-500 mr-1 shrink-0" /> Risk Tolerance</li>
                                                <li className="flex items-start"><ChevronRight className="h-3 w-3 text-amber-500 mr-1 mt-1 shrink-0" /><span className="leading-tight">Strategy Configuration (Asset Mix, Philosophies, Principles, Account Types, Trading Methodology, Sector/Geographic Targets, Performance Targets)</span></li>
                                                <li className="flex items-start"><ChevronRight className="h-3 w-3 text-amber-500 mr-1 mt-1 shrink-0" /><span className="leading-tight">Portfolio Asset Changes (Tickers, Shares Owned, Current Price, Market Value, Book Cost, and Expected Dividends)</span></li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Content Blurring & On-Demand Refresh:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">To prevent you from acting on outdated advice, the presence of a Stale Data Warning will dynamically blur the underlying report. You can either dismiss the warning or click the <strong>"Refresh Analysis"</strong> button to force the AI to generate a brand new, up-to-date report. A timestamp in the header always ensures you know exactly when the current analysis was generated.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="ai-ripple" ref={el => { contentRefs.current["ai-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-indigo-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-indigo-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ripple Effect: The 4-Pillar Test</h3>
                            </div>
                            <p className="text-neutral-700 dark:text-neutral-300 mb-4">
                                John inputs <code className="bg-neutral-100 dark:bg-neutral-800 px-1 rounded">IBIT</code> (A high-risk Bitcoin ETF) to see if he should buy it.
                            </p>
                            <ul className="space-y-3 text-neutral-600 dark:text-neutral-400 text-sm list-disc list-inside">
                                <li>The AI pulls John's Profile: <strong>Conservative near-retiree</strong>.</li>
                                <li>AI simulates Cathie Wood: <em>Loves it (blockchain disruption).</em></li>
                                <li>AI simulates Warren Buffett: <em>Hates it (lacks intrinsic value).</em></li>
                                <li className="font-semibold text-neutral-900 dark:text-white mt-4">
                                    The Final Verdict: <span className="text-rose-600 dark:text-rose-400 font-normal">While the asset might go up, it violates John's strict profile rules. The output firmly rejects the purchase, proving algorithm loyalty to user intent.</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 6: Global News Guidance */}
                    <section id="global-radar" ref={el => { contentRefs.current["global-radar"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <Globe className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">6. Global News Guidance</h2>
                        </div>

                        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            The Global News Guidance connects real-world geopolitical and macroeconomic news to your portfolio. It fetches live financial headlines and uses AI to analyze how world events impact your specific strategy, identify panic-driven buying opportunities, and stress-test your total net worth.
                        </p>

                        <div id="radar-logic" ref={el => { contentRefs.current["radar-logic"] = el; }} className="space-y-6">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <Globe className="h-5 w-5 mr-2 text-indigo-500" /> Detailed Features & Functionalities
                            </h3>
                            <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                <p className="text-neutral-700 dark:text-neutral-300 mb-4 font-medium">The page features five targeted analyses, one master synthesis, and one total integration view:</p>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">1.</span> <span><strong>Net Worth Stress Test:</strong> Assesses total financial health (liquid + real estate) against this week&apos;s macro events.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">2.</span> <span><strong>Deep Buy Scanner:</strong> Finds panic-driven value opportunities using 3 criteria: non-fundamental price drops, selling exhaustion signals, and below-average valuations.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">3.</span> <span><strong>Opportunity Cost Evaluator:</strong> Identifies &quot;dead money&quot; sectors and suggests strategic rotations based on shifting macro regimes.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">4.</span> <span><strong>Cross-Sectional Impact Report:</strong> Maps weekly news (rates, conflicts, energy) to your Growth/Mix/Dividend allocation.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">5.</span> <span><strong>Full Strategy Critic:</strong> Compares your portfolio against global asset classes (S&P 500, TSX, Bonds, Commodities) and critiques exposure gaps.</span></li>
                                    <li className="flex items-start"><span className="text-indigo-500 mr-2 font-bold">6.</span> <span><strong>Deep Critique:</strong> Runs all 5 analyses in parallel, then synthesizes them into a single executive report with Top 3 Actions, Top 3 Deep Buy Stocks, Single Biggest Risk, and Strategic Outlook.</span></li>
                                </ul>
                                <div className="mt-6 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
                                    <div>
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Live News Integration:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">Headlines are fetched daily from NewsData.io covering interest rates, inflation, energy, commodities, geopolitical events, and central bank policy. News is cached globally (shared across all users) to conserve API quota.</span>
                                    </div>
                                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Intelligent Caching & Stale Warnings:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">Same smart caching as AI Guidance. Analyses are cached per-household and fingerprinted against your portfolio, strategy, <em>and</em> the news date. If any of these change, a Stale Data Warning appears with the report blurred until you refresh.</span>
                                    </div>
                                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                        <strong className="text-neutral-900 dark:text-white block mb-1">Deep Critique Progress Tracking:</strong>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">When running the Deep Critique, a real-time checklist shows each of the 5 sub-analyses completing with checkmarks. Failed analyses are gracefully noted and excluded from synthesis. Once all complete, the unified executive report streams in.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="radar-ripple" ref={el => { contentRefs.current["radar-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-indigo-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-indigo-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ripple Effect: The Deep Critique</h3>
                            </div>
                            <p className="text-neutral-700 dark:text-neutral-300 mb-4">
                                John clicks the <strong>Deep Critique</strong> card on a Monday morning after a turbulent week in global markets.
                            </p>
                            <ul className="space-y-3 text-neutral-600 dark:text-neutral-400 text-sm list-disc list-inside">
                                <li>The system fires 5 parallel AI analyses, each examining a different dimension of John&apos;s portfolio against the latest headlines.</li>
                                <li>A live checklist shows progress: <em>Net Worth Stress Test &#10003;, Deep Buy Scanner &#10003;, Opportunity Cost &#10003;...</em></li>
                                <li>Once all 5 complete, the AI synthesizes everything into one executive report.</li>
                                <li className="font-semibold text-neutral-900 dark:text-white mt-4">
                                    The Result: <span className="text-teal-600 dark:text-teal-400 font-normal">A single-page report listing the Top 3 Immediate Actions, Top 3 Deep Buy Stocks of the Week, the Single Biggest Risk, and a Strategic Outlook &mdash; all grounded in real news and John&apos;s actual holdings.</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* Section 7: Settings */}
                    <section id="settings" ref={el => { contentRefs.current["settings"] = el; }} className="space-y-8 scroll-m-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                                <Settings className="h-8 w-8 text-neutral-700 dark:text-neutral-300" />
                            </div>
                            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">7. Settings & Infrastructure</h2>
                        </div>

                        <div id="set-logic" ref={el => { contentRefs.current["set-logic"] = el; }} className="space-y-6">
                            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white flex items-center">
                                <Settings className="h-5 w-5 mr-2 text-indigo-500" /> Detailed Features & Functionalities
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-neutral-600 dark:text-neutral-400">
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <strong className="text-neutral-900 dark:text-white block mb-2">A. Appearance</strong>
                                    Theme Toggles: Instantly switch between Light, Dark, or System themes. The UI provides a real-time preview context noting which theme is actively applied.
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                                    <strong className="text-neutral-900 dark:text-white block mb-2">B. Account & Security</strong>
                                    Identity Display shows the authorized email. Perfect Segregation confirms all data is cryptographically isolated to your unique Household ID.
                                </div>
                                <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 md:col-span-2">
                                    <strong className="text-neutral-900 dark:text-white block mb-2">C. Household Settings</strong>
                                    Household Management lets you create or join a household using secure alphanumeric ID codes. Shared Access allows you to invite spouses or financial planners into your cryptographic partition, securely sharing data.
                                </div>
                            </div>
                        </div>

                        <div id="set-ripple" ref={el => { contentRefs.current["set-ripple"] = el; }} className="bg-white dark:bg-[#0a0a0a] rounded-xl border-l-4 border-l-teal-500 border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-md">
                            <div className="flex items-center space-x-2 mb-4">
                                <Zap className="h-5 w-5 text-teal-600" />
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">The Ripple Effect: Instant Synchronization</h3>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 border border-neutral-200 dark:border-neutral-800 relative">
                                <Zap className="h-6 w-6 text-yellow-500 absolute top-4 right-4 animate-pulse opacity-50" />
                                <p className="text-neutral-700 dark:text-neutral-300 italic text-sm leading-relaxed max-w-2xl">
                                    "John links his wife Mary to his Household ID. Because they share the cryptographic partition, the moment John hits 'Save' on his iPad in the Portfolio page, Mary's laptop screen instantly updates. Her Net Worth calculation auto-corrects, and if she asks a question on Expert Guidance, the AI immediately knows about the new money John just added. Zero lag. One interconnected entity."
                                </p>
                            </div>
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
}
