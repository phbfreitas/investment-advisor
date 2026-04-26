"use client";

import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import HouseholdSettings from "../profile/household/HouseholdSettings";
import type { Session } from "next-auth";

interface RefreshConfig {
    frequencyDays: number;
    lastRefreshedAt: string | null;
    startedAt: string | null;
    status: string;
    articleCount: number;
}

export function SettingsClient({ user }: { user?: Session["user"] }) {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const [refreshConfig, setRefreshConfig] = useState<RefreshConfig | null>(null);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [triggerLoading, setTriggerLoading] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollCountRef = useRef(0);

    // Avoid hydration mismatch by waiting for client mount to read theme
    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchRefreshConfig = useCallback(async (): Promise<RefreshConfig | null> => {
        try {
            const r = await fetch('/api/settings/persona-refresh');
            if (!r.ok) return null;
            return await r.json();
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        fetchRefreshConfig().then(data => { if (data) setRefreshConfig(data); });
    }, [fetchRefreshConfig]);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        pollCountRef.current = 0;
    }, []);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);

    const startPolling = useCallback(() => {
        stopPolling();
        pollCountRef.current = 0;
        pollingRef.current = setInterval(async () => {
            pollCountRef.current += 1;
            const data = await fetchRefreshConfig();
            if (data) {
                setRefreshConfig(data);
                if (data.status !== "refreshing" || pollCountRef.current >= 30) {
                    stopPolling();
                    if (data.status === "success" && data.articleCount > 0) {
                        setTriggerMessage({ type: "success", text: `Refresh complete \u2014 ${data.articleCount} articles indexed.` });
                    } else if (data.status === "success" && data.articleCount === 0) {
                        setTriggerMessage({ type: "error", text: "Refresh complete but no articles were found." });
                    } else if (data.status === "error") {
                        setTriggerMessage({ type: "error", text: "Refresh failed \u2014 check Lambda logs." });
                    } else if (pollCountRef.current >= 30) {
                        setTriggerMessage({ type: "error", text: "Polling timed out \u2014 refresh may still be running. Reload to check." });
                    }
                }
            }
        }, 10_000);
    }, [fetchRefreshConfig, stopPolling]);

    const handleFrequencyChange = async (days: number) => {
        setRefreshLoading(true);
        setSaveMessage(null);
        try {
            const res = await fetch('/api/settings/persona-refresh', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frequencyDays: days }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setSaveMessage({ type: "error", text: (err as { error?: string }).error ?? res.statusText });
                setTimeout(() => setSaveMessage(null), 5000);
                return;
            }
            setRefreshConfig(prev => prev ? { ...prev, frequencyDays: days } : null);
            setSaveMessage({ type: "success", text: "Saved" });
            setTimeout(() => setSaveMessage(null), 2500);
        } finally {
            setRefreshLoading(false);
        }
    };

    const isPolling = pollingRef.current !== null;

    const handleTriggerRefresh = async () => {
        setTriggerLoading(true);
        setTriggerMessage(null);
        try {
            const res = await fetch('/api/settings/persona-refresh/trigger', { method: 'POST' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setTriggerMessage({ type: "error", text: (err as { error?: string }).error ?? "Failed to trigger refresh." });
                return;
            }
            setRefreshConfig(prev => prev ? { ...prev, status: "refreshing", startedAt: new Date().toISOString() } : null);
            setTriggerMessage({ type: "success", text: "Refresh triggered \u2014 polling for completion..." });
            startPolling();
        } finally {
            setTriggerLoading(false);
        }
    };

    const getActiveTheme = () => {
        if (theme === 'system') return systemTheme;
        return theme;
    };

    const getElapsedText = (startedAt: string | null) => {
        if (!startedAt) return null;
        const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
        if (elapsed < 60) return `Started ${elapsed}s ago`;
        return `Started ${Math.round(elapsed / 60)}m ago`;
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Settings</h1>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-1">Manage your application preferences and appearance.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Appearance Card */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-colors duration-300">
                    <div className="p-6">
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">Appearance</h2>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">Customize how Financial Brain looks on your device.</p>

                        <div className="space-y-4">
                            {/* Theme Toggles */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border flex-1 transition-all ${theme === 'light'
                                        ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/50 text-teal-700 dark:text-teal-400'
                                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                                        }`}
                                >
                                    <SunIcon className="w-5 h-5" />
                                    <span className="font-medium">Light</span>
                                </button>

                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border flex-1 transition-all ${theme === 'dark'
                                        ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/50 text-teal-700 dark:text-teal-400'
                                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                                        }`}
                                >
                                    <MoonIcon className="w-5 h-5" />
                                    <span className="font-medium">Dark</span>
                                </button>

                                <button
                                    onClick={() => setTheme('system')}
                                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border flex-1 transition-all ${theme === 'system'
                                        ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/50 text-teal-700 dark:text-teal-400'
                                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                                        }`}
                                >
                                    <ComputerDesktopIcon className="w-5 h-5" />
                                    <span className="font-medium">System</span>
                                </button>
                            </div>

                            {/* Real-time Theme Preview Context */}
                            {mounted && (
                                <p className="text-xs text-neutral-500 dark:text-neutral-500 pt-2 text-center sm:text-left">
                                    Currently applying <span className="font-semibold text-neutral-700 dark:text-neutral-300">{getActiveTheme()}</span> theme.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Account Info Card */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-colors duration-300">
                    <div className="p-6">
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">Account & Security</h2>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">Your authorization and cryptographic data separation status.</p>

                        <div className="bg-neutral-50 dark:bg-neutral-950 rounded-lg p-4 border border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <div>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">Authorized Email Identity</p>
                                    <p className="text-base text-neutral-900 dark:text-white">{user?.email || "Unknown"}</p>
                                </div>
                                <div>
                                    <span className="inline-flex items-center rounded-md bg-green-100 dark:bg-green-500/10 px-2 py-1 text-xs font-medium text-green-800 dark:text-green-400 ring-1 ring-inset ring-green-500/30 dark:ring-green-500/20">
                                        Perfect Segregation Active
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-4 leading-relaxed">
                                All Profile parameters and Asset models are cryptographically isolated to your specific Household ID partition in DynamoDB. Your data is only visible to you and the family members you explicitly invite below.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Household Settings Card */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-colors duration-300">
                    <HouseholdSettings />
                </div>

                {/* Dynamic Knowledge Sources Card */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-colors duration-300">
                    <div className="p-6">
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">Dynamic Knowledge Sources</h2>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">Configure how frequently the Money Guy advisor refreshes its article knowledge base.</p>

                        {refreshConfig === null ? (
                            <div className="h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                        ) : (
                            <div className="space-y-5">
                                {/* Status row */}
                                <div className="flex items-center justify-between gap-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg p-4 border border-neutral-200 dark:border-neutral-800">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl" aria-hidden="true">💰</span>
                                        <span className="text-sm font-medium text-neutral-900 dark:text-white">Money Guy — The Financial Order of Operations</span>
                                    </div>
                                    <div className="shrink-0">
                                        {refreshConfig.status === "refreshing" && (
                                            <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-800 dark:text-blue-400 ring-1 ring-inset ring-blue-500/30 dark:ring-blue-500/20 animate-pulse">
                                                Refreshing...
                                            </span>
                                        )}
                                        {refreshConfig.status === "success" && refreshConfig.articleCount > 0 && (
                                            <span className="inline-flex items-center rounded-md bg-green-100 dark:bg-green-500/10 px-2 py-1 text-xs font-medium text-green-800 dark:text-green-400 ring-1 ring-inset ring-green-500/30 dark:ring-green-500/20">
                                                Up to date
                                            </span>
                                        )}
                                        {refreshConfig.status === "success" && refreshConfig.articleCount === 0 && (
                                            <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-400 ring-1 ring-inset ring-amber-500/30 dark:ring-amber-500/20">
                                                No articles found
                                            </span>
                                        )}
                                        {refreshConfig.status === "error" && (
                                            <span className="inline-flex items-center rounded-md bg-red-100 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-800 dark:text-red-400 ring-1 ring-inset ring-red-500/30 dark:ring-red-500/20">
                                                Refresh failed
                                            </span>
                                        )}
                                        {refreshConfig.status !== "success" && refreshConfig.status !== "error" && refreshConfig.status !== "refreshing" && (
                                            <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 ring-1 ring-inset ring-neutral-500/30 dark:ring-neutral-500/20">
                                                Never refreshed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div className="flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                                    {refreshConfig.status === "refreshing" ? (
                                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                                            {getElapsedText(refreshConfig.startedAt) ?? "Starting..."}
                                        </span>
                                    ) : (
                                        <>
                                            <span>
                                                <span className="font-medium text-neutral-900 dark:text-white">{refreshConfig.articleCount}</span> articles indexed
                                            </span>
                                            <span>
                                                Last updated:{" "}
                                                <span className="font-medium text-neutral-900 dark:text-white">
                                                    {refreshConfig.lastRefreshedAt
                                                        ? new Date(refreshConfig.lastRefreshedAt).toLocaleString(undefined, {
                                                            year: "numeric",
                                                            month: "numeric",
                                                            day: "numeric",
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        })
                                                        : "Never"}
                                                </span>
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Frequency selector */}
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Refresh frequency</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[1, 3, 7, 14, 30].map((days) => {
                                            const isActive = refreshConfig.frequencyDays === days;
                                            return (
                                                <button
                                                    key={days}
                                                    onClick={() => handleFrequencyChange(days)}
                                                    disabled={refreshLoading}
                                                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        isActive
                                                            ? 'bg-teal-50 dark:bg-teal-500/10 border-2 border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-400'
                                                            : 'bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                                                    }`}
                                                >
                                                    {isActive && <CheckCircle2 className="h-4 w-4" />}
                                                    {days} {days === 1 ? "Day" : "Days"}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Save feedback */}
                                    {saveMessage && (
                                        <div className={`flex items-center gap-1.5 text-sm font-medium mt-1 ${
                                            saveMessage.type === "error"
                                                ? "text-red-600 dark:text-red-400 border-l-4 border-l-red-500 pl-3 py-1"
                                                : "text-teal-600 dark:text-teal-400"
                                        }`}>
                                            {saveMessage.type === "success" && <CheckCircle2 className="h-4 w-4" />}
                                            {saveMessage.text}
                                        </div>
                                    )}
                                </div>

                                {/* Manual trigger */}
                                <div className="space-y-2 pt-1">
                                    <button
                                        onClick={handleTriggerRefresh}
                                        disabled={triggerLoading || isPolling}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 text-sm font-medium transition-all hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {triggerLoading ? "Triggering\u2026" : isPolling ? "Refreshing\u2026" : "\u26A1 Trigger Refresh Now"}
                                    </button>
                                    {/* Trigger feedback */}
                                    {triggerMessage && (
                                        <div className={`flex items-center gap-1.5 text-sm font-medium ${
                                            triggerMessage.type === "error"
                                                ? "text-red-600 dark:text-red-400 border-l-4 border-l-red-500 pl-3 py-1"
                                                : "text-teal-600 dark:text-teal-400"
                                        }`}>
                                            {triggerMessage.type === "success" && <CheckCircle2 className="h-4 w-4" />}
                                            {triggerMessage.text}
                                        </div>
                                    )}
                                </div>

                                {/* Helper text */}
                                <p className="text-xs text-neutral-500 dark:text-neutral-500 leading-relaxed">
                                    The advisor automatically fetches the latest articles from The Money Guy Show on the selected schedule. Use <strong className="text-neutral-600 dark:text-neutral-400">Trigger Refresh Now</strong> to run it immediately.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
