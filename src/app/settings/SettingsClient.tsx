"use client";

import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import HouseholdSettings from "../profile/household/HouseholdSettings";

export function SettingsClient({ user }: { user?: any }) {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch by waiting for client mount to read theme
    useEffect(() => {
        setMounted(true);
    }, []);

    const getActiveTheme = () => {
        if (theme === 'system') return systemTheme;
        return theme;
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

            </div>
        </div>
    );
}
