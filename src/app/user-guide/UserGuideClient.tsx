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
    Radio,
    RotateCcw,
    Database,
    ShieldCheck,
    RefreshCw,
    TrendingUp,
    PieChart,
    AlertCircle,
    CheckCircle2,
    Lock,
    Search,
    BookOpen,
    Coins
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
        pillar: "Fundação & UX / Foundation & UX",
        pillarIcon: Shield,
        pillarAccent: "text-indigo-600 dark:text-indigo-400",
        items: [
            {
                id: "livro-1",
                title: "LIVRO I: Gênese & Arquitetura",
                icon: Info,
                subsections: [
                    { id: "philosophy-manifesto", title: "A Diretriz Primária / Primary Directive" },
                    { id: "philosophy-ripple", title: "Arquitetura Ripple / Ripple Architecture" },
                ]
            },
            {
                id: "livro-2",
                title: "LIVRO II: Taxonomia da Interface",
                icon: Search,
                subsections: [
                    { id: "nav-sidebar", title: "Sidebar Strategy" },
                    { id: "nav-global", title: "Global Bar Elements" },
                ]
            },
        ]
    },
    {
        pillar: "Governança / Governance",
        pillarIcon: Database,
        pillarAccent: "text-teal-600 dark:text-teal-400",
        items: [
            {
                id: "livro-3",
                title: "LIVRO III: Guardião de Identidade",
                icon: Target,
                subsections: [
                    { id: "strat-philosophy", title: "Philosophy & Risk" },
                    { id: "strat-drift", title: "Gestão de Drift / Drift Management" },
                ]
            },
            {
                id: "livro-4",
                title: "LIVRO IV: Governança de Portfólio",
                icon: LayoutDashboard,
                subsections: [
                    { id: "holdings-registry", title: "Atomic Registry" },
                    { id: "holdings-edit", title: "Edição / Inline Editing" },
                ]
            },
            {
                id: "livro-5",
                title: "LIVRO V: Motor Time Machine",
                icon: RotateCcw,
                subsections: [
                    { id: "tm-audit", title: "Audit Trail Ledger" },
                    { id: "tm-rollback", title: "Cascade Rollback" },
                ]
            },
        ]
    },
    {
        pillar: "Inteligência & IA / Intelligence & AI",
        pillarIcon: BrainCircuit,
        pillarAccent: "text-rose-600 dark:text-rose-400",
        items: [
            {
                id: "livro-6",
                title: "LIVRO VI: Market Intelligence",
                icon: Globe,
                subsections: [
                    { id: "radar-global", title: "Global Radar" },
                    { id: "radar-directives", title: "Strategic Directives" },
                ]
            },
            {
                id: "livro-7",
                title: "LIVRO VII: Ingestão PDF / PDF Import",
                icon: Zap,
                subsections: [
                    { id: "pdf-workflow", title: "3-Stage Workflow" },
                    { id: "pdf-sync", title: "Atomic Sync" },
                ]
            },
            {
                id: "livro-8",
                title: "LIVRO VIII: O Guru AI (RAG)",
                icon: Users,
                subsections: [
                    { id: "guru-motor", title: "Context Motor" },
                    { id: "guru-personas", title: "Persona Selection" },
                ]
            },
        ]
    },
    {
        pillar: "Finanças & Segurança / Wealth & Security",
        pillarIcon: Lock,
        pillarAccent: "text-amber-600 dark:text-amber-400",
        items: [
            {
                id: "livro-9",
                title: "LIVRO IX: Alquimia de Finanças",
                icon: Wallet,
                subsections: [
                    { id: "alquimia-budget", title: "Budget vs Actuals" },
                    { id: "alquimia-rental", title: "Rental Reality" },
                ]
            },
            {
                id: "livro-10",
                title: "LIVRO X: Protocolos de Segurança",
                icon: ShieldCheck,
                subsections: [
                    { id: "seguranca-identidade", title: "Atomic Identity" },
                    { id: "seguranca-household", title: "Household Governance" },
                ]
            },
            {
                id: "livro-11",
                title: "LIVRO XI: Ecossistema Técnico",
                icon: Code,
                subsections: [
                    { id: "tech-hierarchy", title: "Classification Engine" },
                    { id: "tech-stack", title: "Stack Tecnológica" },
                ]
            },
        ]
    },
    {
        pillar: "Referência / Reference",
        pillarIcon: Info,
        pillarAccent: "text-blue-600 dark:text-blue-400",
        items: [
            {
                id: "livro-12",
                title: "LIVRO XII: Troubleshooting",
                icon: AlertCircle,
                subsections: [
                    { id: "err-dictionary", title: "Error Glossary" },
                ]
            },
            {
                id: "livro-13",
                title: "LIVRO XIII: Filosofia / Philosophy",
                icon: CheckCircle2,
                subsections: [
                    { id: "mindset-pillars", title: "The 3 Pillars" },
                ]
            },
            {
                id: "livro-14",
                title: "LIVRO XIV: Glossário do Oráculo",
                icon: BookOpen,
                subsections: [
                    { id: "glossary-market", title: "Market Terms" },
                    { id: "glossary-platform", title: "System Terms" },
                ]
            },
            {
                id: "livro-15",
                title: "LIVRO XV: Roadmap Estratégico",
                icon: TrendingUp,
                subsections: [
                    { id: "road-phase2", title: "Future Phases" },
                ]
            },
        ]
    }
];

export default function UserGuideClient() {
    const [activeSection, setActiveSection] = useState("livro-1");
    const contentRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    const scrollToSection = (id: string, parentId?: string) => {
        setActiveSection(parentId || id);
        contentRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-white dark:bg-[#050505] transition-colors duration-300">

            {/* Internal Navigation Sidebar */}
            <aside className="w-full md:w-72 max-h-[40vh] md:max-h-none border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/50 dark:bg-[#080808] shrink-0">
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

                    {/* LIVRO I: Gênese & Arquitetura */}
                    <section id="livro-1" ref={el => { contentRefs.current["livro-1"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-400">Pillar 1: Fundação & UX / Foundation & UX</span>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO I: Gênese & Arquitetura<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-3xl md:text-4xl uppercase">Genesis & Architecture</span>
                            </h1>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <p className="text-lg text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                                        Bem-vindo ao manual definitivo de tradução técnica para negócios da plataforma Investment Advisor. Este guia foi construído para ajudar usuários a entenderem exatamente <strong>como o software pensa</strong>.
                                    </p>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed italic">
                                        Welcome to the definitive backend-to-business translation manual for the Investment Advisor. This guide is built to help users understand exactly <strong>how the software thinks</strong>.
                                    </p>
                                </div>
                                <div id="philosophy-manifesto" ref={el => { contentRefs.current["philosophy-manifesto"] = el; }} className="bg-neutral-50 dark:bg-[#0a0a0a] rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-3">A Diretriz Primária / The Primary Directive</h4>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                        A plataforma é organizada em dois pilares de navegação: <strong>My Blueprint</strong> (seu cofre privado de dados estáticos e dinâmicos) e <strong>Market Intelligence</strong> (motores de orientação ativa e dados externos).
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-500 italic border-t border-neutral-200 dark:border-neutral-800 pt-3">
                                        The platform is organized into two navigation pillars: <strong>My Blueprint</strong> (your private vault) and <strong>Market Intelligence</strong> (active guidance and external data).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Ripple Architecture Card */}
                        <div id="philosophy-ripple" ref={el => { contentRefs.current["philosophy-ripple"] = el; }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50/50 via-white to-teal-50/50 dark:from-indigo-950/20 dark:via-neutral-900 dark:to-teal-900/20 border border-neutral-200 dark:border-neutral-800 shadow-xl group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/20 transition-all duration-1000"></div>
                            
                            <div className="relative p-8 md:p-12 space-y-8">
                                <div className="flex items-center space-x-4">
                                    <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10">
                                        <Zap className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Arquitetura Ripple / Ripple Architecture</h2>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-medium tracking-tight">O Efeito Cascata da Verdade / The Cascading Truth Effect</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider text-xs">Português (Brasil)</h4>
                                            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                                Explicamos a lógica matemática e o "Ripple Effect" — como um número inserido em um lugar gatilha mudanças em todo o sistema. Se você alterar seu perfil de risco em <strong>My Investment Strategy</strong>, o <strong>AI Guidance</strong> instantaneamente recodifica seus conselhos.
                                            </p>
                                        </div>
                                        <div className="bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-xl p-5 border border-white dark:border-white/5 shadow-sm">
                                            <p className="text-neutral-700 dark:text-neutral-300 font-medium text-sm italic leading-relaxed">
                                                "Sua riqueza não é estática; ela é uma rede de funções matemáticas interconectadas."
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider text-xs">English</h4>
                                            <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-sm">
                                                We explain the mathematical logic and the "Ripple Effect"—how a number entered in one place triggers changes across the entire system. If you change your risk in <strong>My Investment Strategy</strong>, the <strong>AI Guidance</strong> instantly rewires its advice.
                                            </p>
                                        </div>
                                        <div className="bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-xl p-5 border border-white dark:border-white/5 shadow-sm">
                                            <p className="text-neutral-500 dark:text-neutral-400 font-medium text-sm italic leading-relaxed">
                                                "Your wealth is not static; it is a web of interconnected mathematical functions."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO II: Taxonomia da Interface */}
                    <section id="livro-2" ref={el => { contentRefs.current["livro-2"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <Search className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-indigo-600 dark:text-indigo-400">Pillar 1: Navegação / Navigation</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO II: Taxonomia da Interface<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Interface Taxonomy</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <h3 id="nav-sidebar" ref={el => { contentRefs.current["nav-sidebar"] = el; }} className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-indigo-500 pl-4">
                                        Estratégia de Sidebar / Sidebar Strategy
                                    </h3>
                                    <div className="space-y-4">
                                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                            A interface é dividida em dois domínios ontológicos: <strong>My Blueprint</strong> (estático/histórico) e <strong>Market Intelligence</strong> (dinâmico/futuro). Esta separação garante que o usuário saiba se está olhando para seus próprios dados ou para a análise do mercado.
                                        </p>
                                        <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                            The interface is divided into two ontological domains: <strong>My Blueprint</strong> (static/historical) and <strong>Market Intelligence</strong> (dynamic/future). This ensures clarity between private data and market analysis.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h3 id="nav-global" ref={el => { contentRefs.current["nav-global"] = el; }} className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-indigo-500 pl-4 text-right">
                                        Elementos Globais / Global Elements
                                    </h3>
                                    <div className="space-y-4 text-right">
                                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                            A Barra Superior contém o Oráculo de Busca (Universal Search) e o seletor de Household. Cada elemento é projetado para acesso instantâneo, independentemente de onde você esteja na aplicação.
                                        </p>
                                        <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                            The Top Bar contains the Universal Search Oracle and the Household selector. Every element is designed for instant access regardless of your location in the app.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO III: Guardião de Identidade */}
                    <section id="livro-3" ref={el => { contentRefs.current["livro-3"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                    <Target className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-teal-600 dark:text-teal-400">Pillar 2: Governança / Governance</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO III: Guardião de Identidade<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Identity Guardian</span>
                            </h2>
                            
                            <div id="strat-philosophy" ref={el => { contentRefs.current["strat-philosophy"] = el; }} className="bg-neutral-50 dark:bg-[#0a0a0a] rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm mb-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Filosofia & Risco / Philosophy & Risk</h3>
                                        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                            O <strong>Risk Tolerance Slider</strong> (1-10) é o volante da IA. Um valor de 1 é conservador; 10 é totalmente especulativo. Este número calibra todos os conselhos gerados no sistema, alterando os "circuitos cerebrais" dos consultores virtuais.
                                        </p>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">English Interpretation</h4>
                                        <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-sm italic">
                                            The <strong>Risk Tolerance Slider</strong> (1-10) is the AI&apos;s steering wheel. A value of 1 is conservative; 10 is fully speculative. This number calibrates all advice generated by the system.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div id="strat-drift" ref={el => { contentRefs.current["strat-drift"] = el; }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <LineChart className="h-20 w-20" />
                                    </div>
                                    <h4 className="font-bold text-neutral-900 dark:text-white mb-3">Gestão de Drift / Drift Management</h4>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                        O sistema compara seus alvos (Target %) contra o portfolio real (Actual %) e exibe uma tabela de drift. Desvios maiores que 5% disparam alertas visuais imediatos.
                                    </p>
                                </div>
                                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Globe className="h-20 w-20" />
                                    </div>
                                    <h4 className="font-bold text-neutral-500 dark:text-neutral-500 mb-3">Drift Management (EN)</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-500 leading-relaxed italic">
                                        The system compares your targets against actual holdings and displays a drift table. Deviations over 5% trigger immediate visual alerts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO IV: Governança de Portfólio */}
                    <section id="livro-4" ref={el => { contentRefs.current["livro-4"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                    <LayoutDashboard className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-teal-600 dark:text-teal-400">Pillar 2: Governança / Governance</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO IV: Governança de Portfólio<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Portfolio Governance</span>
                            </h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div id="holdings-registry" ref={el => { contentRefs.current["holdings-registry"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Atomic Registry (Registro Atômico)</h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Cada holding é um objeto matemático único. O sistema rastreia Ticker, Quantidade, Preço Médio (Book Cost) e integra com dados do Yahoo Finance para calcular o Market Value em tempo real.
                                    </p>
                                    <div className="p-4 rounded-xl bg-teal-100/50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                                        <p className="text-xs text-teal-800 dark:text-teal-300 italic font-medium">
                                            &quot;Every asset is a mathematical proof of your strategy application.&quot;
                                        </p>
                                    </div>
                                </div>
                                <div id="holdings-edit" ref={el => { contentRefs.current["holdings-edit"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-500 dark:text-neutral-400">Inline Editing & Automation</h3>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-sm italic">
                                        Edit assets directly in the table. Ticker lookups are automated, fetching live prices instantly. The UI uses glassmorphic indicators to confirm that every edit is captured in the universal audit trail.
                                    </p>
                                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                                        Edição direta na tabela com busca automatizada de tickers. A interface usa indicadores para confirmar que cada edição foi capturada no rastro de auditoria.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO V: Motor Time Machine */}
                    <section id="livro-5" ref={el => { contentRefs.current["livro-5"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                    <RotateCcw className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-teal-600 dark:text-teal-400">Pillar 2: Governança / Governance</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO V: Motor Time Machine<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Time Machine Engine</span>
                            </h2>
                            
                            <div className="relative overflow-hidden rounded-3xl bg-neutral-900 dark:bg-black p-8 md:p-12 text-white border border-white/5 shadow-2xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px]"></div>
                                <div className="relative space-y-8">
                                    <div className="flex items-center space-x-4">
                                        <div className="h-12 w-12 rounded-xl bg-teal-500 flex items-center justify-center text-black">
                                            <RotateCcw className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-2xl font-bold">Audit Trail Ledger / Livro de Auditoria</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <p id="tm-audit" ref={el => { contentRefs.current["tm-audit"] = el; }} className="text-neutral-400 leading-relaxed text-sm">
                                                Cada mutação do portfolio — manual ou via PDF — é registrada com snapshots de &quot;antes&quot; e &quot;depois&quot;. O Time Machine permite visualizar diffs coloridos para cada transação e entender a origem de cada centavo.
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            <h4 id="tm-rollback" ref={el => { contentRefs.current["tm-rollback"] = el; }} className="font-bold text-teal-400 text-sm uppercase tracking-wider">Cascade Rollback (EN)</h4>
                                            <p className="text-neutral-500 leading-relaxed text-xs italic">
                                                Revert any change and all subsequent ones in reverse chronological order. This ensures data integrity by preventing orphan records or inconsistent states during historical rewinds.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO VI: Market Intelligence */}
                    <section id="livro-6" ref={el => { contentRefs.current["livro-6"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                    <Globe className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400">Pillar 3: Inteligência & IA / Intelligence & AI</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO VI: Market Intelligence<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Market & Guidance Reactor</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div id="radar-global" ref={el => { contentRefs.current["radar-global"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-rose-500 pl-4">
                                        Global Radar (Sinal Macro)
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        O <strong>Global News Guidance</strong> conecta manchetes geopolíticas ao seu cofre. Ele utiliza integração com <code>NewsData.io</code> para realizar testes de estresse em tempo real, analisando como taxas de juros ou conflitos afetam seu <em>Net Worth</em>.
                                    </p>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                        The Global News Guidance connects geopolitical headlines to your vault. It uses <code>NewsData.io</code> integration for real-time stress tests, analyzing how macro variables affect your <em>Net Worth</em>.
                                    </p>
                                </div>
                                <div id="radar-directives" ref={el => { contentRefs.current["radar-directives"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-rose-500 pl-4">
                                        Strategic Directives (O Motor Analítico)
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Através de diretivas de IA (como Rebalancing ou Dividend Optimization), o sistema gera relatórios multi-página com dados em streaming. Inclui avisos de &quot;Stale Data&quot; caso seu portfólio mude antes de você atualizar a análise.
                                    </p>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                        Through AI directives, the system generates streaming multi-page reports. Includes &quot;Stale Data&quot; warnings if your portfolio changes before you refresh the analysis.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO VII: Ingestão PDF / PDF Import */}
                    <section id="livro-7" ref={el => { contentRefs.current["livro-7"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                    <Zap className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400">Pillar 3: Inteligência & IA / Intelligence & AI</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO VII: Ingestão PDF / PDF Import<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Atomic Ingestion Engine</span>
                            </h2>

                            <div id="pdf-workflow" ref={el => { contentRefs.current["pdf-workflow"] = el; }} className="bg-neutral-50 dark:bg-[#0a0a0a] rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm mb-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-sm leading-relaxed">
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Fluxo de 3 Estágios / Stage Workflow</h3>
                                        <p className="text-neutral-600 dark:text-neutral-400">
                                            1. <strong>Parsing</strong>: Extração de texto via OCR e processamento de linguagem natural.<br/>
                                            2. <strong>Validation</strong>: Verificação de duplicatas e limpeza de ruído.<br/>
                                            3. <strong>Atomic Sync</strong>: Gravação irreversível (via Time Machine) no banco de dados.
                                        </p>
                                    </div>
                                    <div id="pdf-sync" ref={el => { contentRefs.current["pdf-sync"] = el; }} className="space-y-4">
                                        <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Atomic Sync & Deduplication</h3>
                                        <p className="text-neutral-500 dark:text-neutral-500 italic">
                                            The system resolves Canadian tickers (appending .TO) and matches assets by Ticker + Account ID. Redundant records are automatically pruned to maintain the &quot;Gold Standard&quot; of truth.
                                        </p>
                                        <p className="text-neutral-600 dark:text-neutral-400">
                                            Resolução automática de tickers canadenses e cruzamento de dados para evitar duplicidade entre PDFs e registros manuais.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO VIII: O Guru AI (RAG) */}
                    <section id="livro-8" ref={el => { contentRefs.current["livro-8"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                    <BrainCircuit className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400">Pillar 3: Inteligência & IA / Intelligence & AI</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO VIII: O Guru AI (RAG)<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Chat & Knowledge Matrix</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div id="guru-motor" ref={el => { contentRefs.current["guru-motor"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-rose-500 pl-4">
                                        Motor de Contexto / Context Motor
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Utilizamos RAG (<em>Retrieval-Augmented Generation</em>) para injetar seus dados privados (Holdings e Estratégia) no contexto da IA com segurança. Isso garante que o Guru nunca dê conselhos genéricos; ele sempre sabe exatamente o que você possui.
                                    </p>
                                    <div className="p-4 rounded-xl bg-orange-100/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                                        <p className="text-xs text-orange-800 dark:text-orange-300 italic font-medium">
                                            &quot;The AI doesn&apos;t just chat; it audits your reality before speaking.&quot;
                                        </p>
                                    </div>
                                </div>
                                <div id="guru-personas" ref={el => { contentRefs.current["guru-personas"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-rose-500 pl-4">
                                        Seleção de Personas / Persona Selection
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Escolha entre arquiteturas de pensamento distintas: <strong>Buffett</strong> (Valor/Longo Prazo), <strong>Cathie Wood</strong> (Inovação/Agressivo) ou <strong>Dave Ramsey</strong> (Disciplina/Gestão de Dívidas). A lógica da IA muda drasticamente de acordo com o Guru escolhido.
                                    </p>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                        Select distinct thinking architectures: <strong>Buffett</strong> (Value/Long Term), <strong>Cathie Wood</strong> (Innovation/Aggressive), or <strong>Dave Ramsey</strong> (Debt/Discipline).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />


                    {/* LIVRO IX: Alquimia de Finanças */}
                    <section id="livro-9" ref={el => { contentRefs.current["livro-9"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <Coins className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-amber-600 dark:text-amber-400">Pillar 4: Riqueza & Segurança / Wealth & Security</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO IX: Alquimia de Finanças<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Cash Flow & Real Estate Mastery</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div id="alquimia-budget" ref={el => { contentRefs.current["alquimia-budget"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                        Budget vs Actuals (O Reflexo do Gasto)
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Integramos seu orçamento mensal diretamente à sua capacidade de investimento. O sistema monitora o &quot;investable cash&quot; e sugere aportes baseados no que sobrou no mês, garantindo que o plano de aposentadoria nunca fique no papel.
                                    </p>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                        We integrate your monthly budget directly with your investment capacity. The system monitors &quot;investable cash&quot; and suggests contributions based on monthly surplus.
                                    </p>
                                </div>
                                <div id="alquimia-rental" ref={el => { contentRefs.current["alquimia-rental"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                        Rental Reality (Yield Imobiliário Real)
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Não olhe apenas para o aluguel bruto. O motor imobiliário desconta automaticamente taxas de condomínio, IPTU e manutenção para entregar o <em>Net Yield</em>. Compare seus imóveis com o retorno de dividendos do mercado financeiro em um clique.
                                    </p>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                        Real Estate engine automatically deducts fees, taxes, and maintenance to deliver <em>Net Yield</em>. Compare property returns with stock market dividends instantly.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO X: Protocolos de Segurança */}
                    <section id="livro-10" ref={el => { contentRefs.current["livro-10"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-amber-600 dark:text-amber-400">Pillar 4: Riqueza & Segurança / Wealth & Security</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO X: Protocolos de Segurança<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Fortress Security & Governance</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div id="seguranca-identidade" ref={el => { contentRefs.current["seguranca-identidade"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                        Identidade Atômica / Atomic Identity
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Segregação perfeita de dados. Cada pedaço de informação é autenticado contra seu *Household ID* único. Seus ativos nunca se misturam aos de outros usuários, mesmo em queries de massa do Guru AI.
                                    </p>
                                    <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-500 italic">
                                            Cryptographic data isolation at the Household level ensures absolute privacy and zero cross-contamination.
                                        </p>
                                    </div>
                                </div>
                                <div id="seguranca-household" ref={el => { contentRefs.current["seguranca-household"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                        Household Governance
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Compartilhe seu cofre com quem importa. Convide cônjuges ou planejadores financeiros para sua partição segura. O acesso é revogável e controlado por chaves de convite alfanuméricas exclusivas.
                                    </p>
                                    <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                        Share your vault with stakeholders. Invite spouses or planners to your secure partition. Access is revocable and controlled via unique alphanumeric keys.
                                    </p>
                                </div>
                            </div>

                            {/* Blind Admin Encryption */}
                            <div id="seguranca-encryption" ref={el => { contentRefs.current["seguranca-encryption"] = el; }} className="mt-10 space-y-6">
                                <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                    Criptografia em Repouso / Encrypted at Rest
                                </h3>
                                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Seus dados financeiros são criptografados pelo servidor antes de serem gravados no banco de dados — não apenas na transmissão, mas no próprio armazenamento. Valores de portfólio, quantidades, custos, lucros, rendas, despesas e patrimônio líquido são todos transformados em texto cifrado antes de chegarem ao disco.
                                </p>
                                <p className="text-neutral-500 dark:text-neutral-500 leading-relaxed text-xs italic">
                                    Your financial data is encrypted by the application server before it is written to the database — not only in transit, but in storage itself. Portfolio values, quantities, costs, profits, income, expenses, and net worth figures are all transformed into ciphertext before they reach disk.
                                </p>
                                <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-3">
                                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Blind Admin Guarantee</p>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                        Even if someone with direct database access — including our own infrastructure team — were to query the database, they would see only encrypted blobs. Dollar amounts, quantities, account numbers, conversation content, and AI-generated advice are mathematically unreadable without the encryption key held exclusively by the application.
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-500 italic">
                                        Mesmo com acesso direto ao banco de dados, nossa equipe de infraestrutura não consegue ler seus números financeiros, conteúdo de conversas ou conselhos gerados pela IA. Apenas a aplicação, autenticada com sua chave, pode descriptografar esses dados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO XI: Ecossistema Técnico */}
                    <section id="livro-11" ref={el => { contentRefs.current["livro-11"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <Settings className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-amber-600 dark:text-amber-400">Pillar 4: Riqueza & Segurança / Wealth & Security</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO XI: Ecossistema Técnico<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Technical Anatomy & Engine</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div id="tech-hierarchy" ref={el => { contentRefs.current["tech-hierarchy"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                        Classification Engine
                                    </h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm">
                                        Nosso motor de classificação usa uma árvore de decisão determinística baseada em métricas quantitativas:
                                    </p>
                                    <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-2 list-disc ml-4">
                                        <li><strong>Pure Growth</strong>: Yield 0-2% | Index Focused</li>
                                        <li><strong>Pure Dividend</strong>: Yield 2.1-8% | Beta &lt; 1.0</li>
                                        <li><strong>The Mix</strong>: Yield &gt; 8% ou Beta &gt; 1.0</li>
                                    </ul>
                                </div>
                                <div id="tech-stack" ref={el => { contentRefs.current["tech-stack"] = el; }} className="space-y-6">
                                    <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 border-l-2 border-amber-500 pl-4">
                                        Stack Tecnológica
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                                            <span className="block text-[10px] uppercase font-bold text-neutral-400">Frontend</span>
                                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">Next.js 16</span>
                                        </div>
                                        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                                            <span className="block text-[10px] uppercase font-bold text-neutral-400">Intelligence</span>
                                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">OpenAI / RAG</span>
                                        </div>
                                        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                                            <span className="block text-[10px] uppercase font-bold text-neutral-400">Database</span>
                                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">Supabase / PG</span>
                                        </div>
                                        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                                            <span className="block text-[10px] uppercase font-bold text-neutral-400">News</span>
                                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">NewsData.io</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO XII: Troubleshooting */}
                    <section id="livro-12" ref={el => { contentRefs.current["livro-12"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400">Pillar 5: Referência / Reference</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO XII: Troubleshooting<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Error Dictionary & Recovery</span>
                            </h2>

                            <div id="err-dictionary" ref={el => { contentRefs.current["err-dictionary"] = el; }} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-2">PDF Parse Failure</h4>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">Ocorre quando o arquivo não segue o padrão bancário reconhecido.</p>
                                        <div className="text-xs p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg italic">
                                            Solution: Ensure the PDF is a direct export (not a scan) from your bank portal.
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-2">Guru Timeout</h4>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">A engine de RAG excedeu o tempo de processamento.</p>
                                        <div className="text-xs p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg italic">
                                            Solution: Simplify your question or reduce the number of selected documents.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO XIII: Filosofia / Philosophy */}
                    <section id="livro-13" ref={el => { contentRefs.current["livro-13"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400">Pillar 5: Referência / Reference</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO XIII: Filosofia / Philosophy<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">The 3 Pillars of Logic</span>
                            </h2>

                            <div id="mindset-pillars" ref={el => { contentRefs.current["mindset-pillars"] = el; }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <div className="text-3xl font-black text-blue-600/20 dark:text-blue-400/10">01</div>
                                    <h4 className="font-bold text-neutral-800 dark:text-neutral-200">Integridade / Integrity</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                        Dados puros. O sistema recusa interpolações criativas. Se os dados não estão no cofre, a resposta é "Não sei".
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-3xl font-black text-blue-600/20 dark:text-blue-400/10">02</div>
                                    <h4 className="font-bold text-neutral-800 dark:text-neutral-200">Inteligência / Intelligence</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                        Análise preditiva vs Reativa. O Oráculo foca no que o ativo *será*, não no que *foi*.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-3xl font-black text-blue-600/20 dark:text-blue-400/10">03</div>
                                    <h4 className="font-bold text-neutral-800 dark:text-neutral-200">Resiliência / Resilience</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                        Proteção contra o ruído do mercado. Taxas de giro baixas e foco no longo prazo geométrico.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO XIV: Glossário do Oráculo */}
                    <section id="livro-14" ref={el => { contentRefs.current["livro-14"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400">Pillar 5: Referência / Reference</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO XIV: Glossário do Oráculo<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">Terms & Definitions</span>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div id="glossary-market" ref={el => { contentRefs.current["glossary-market"] = el; }} className="space-y-4">
                                    <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">Market Terms</h3>
                                    <dl className="space-y-4">
                                        <div>
                                            <dt className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Beta</dt>
                                            <dd className="text-xs text-neutral-500 dark:text-neutral-500">Média de volatilidade relativa ao mercado (Benchmark).</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Yield</dt>
                                            <dd className="text-xs text-neutral-500 dark:text-neutral-500">Fluxo de caixa gerado pelo ativo (Dividendos/Juros).</dd>
                                        </div>
                                    </dl>
                                </div>
                                <div id="glossary-platform" ref={el => { contentRefs.current["glossary-platform"] = el; }} className="space-y-4">
                                    <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">System Terms</h3>
                                    <dl className="space-y-4">
                                        <div>
                                            <dt className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Ripple ID</dt>
                                            <dd className="text-xs text-neutral-500 dark:text-neutral-500">Identificador único global para rastrear o efeito cascata de dados.</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Time Machine</dt>
                                            <dd className="text-xs text-neutral-500 dark:text-neutral-500">Engine de reconstrução histórica e auditoria de estado passados.</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-neutral-200 dark:border-neutral-800/50" />

                    {/* LIVRO XV: Roadmap Estratégico */}
                    <section id="livro-15" ref={el => { contentRefs.current["livro-15"] = el; }} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-blue-600 dark:text-blue-400">Pillar 5: Referência / Reference</span>
                            </div>
                            <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-6">
                                LIVRO XV: Roadmap Estratégico<br/>
                                <span className="text-neutral-400 dark:text-neutral-600 text-2xl uppercase tracking-tighter font-medium">The Future of Intelligence</span>
                            </h2>

                            <div id="road-phase2" ref={el => { contentRefs.current["road-phase2"] = el; }} className="relative border-l border-neutral-200 dark:border-neutral-800 ml-4 pl-8 space-y-12">
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/20" />
                                    <h4 className="font-bold text-neutral-800 dark:text-neutral-200">Phase II: Auto-Refining (Q3 2026)</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-lg">
                                        Rebalanceamento automático e monitoramento de taxas 24/7. Integração direta com APIs de corretoras globais.
                                    </p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1 h-5 w-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                                    <h4 className="font-bold text-neutral-400 dark:text-neutral-600">Phase III: Decentralized Audit (2027)</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-800 leading-relaxed max-w-lg">
                                        Protocolos de auditoria descentralizada para garantir a imutabilidade dos registros de patrimônio.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
