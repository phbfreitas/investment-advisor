"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AddAssetModal({ isOpen, onClose, onSuccess }: AddAssetModalProps) {
    const [ticker, setTicker] = useState("");
    const [name, setName] = useState("");
    const [assetType, setAssetType] = useState("STOCK");
    const [quantity, setQuantity] = useState("");
    const [averageCost, setAverageCost] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [institution, setInstitution] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            const res = await fetch("/api/assets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticker,
                    name: name || ticker,
                    assetType,
                    quantity,
                    averageCost,
                    currency,
                    institution,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add asset");

            setTicker("");
            setName("");
            setQuantity("");
            setAverageCost("");
            setInstitution("");

            onSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Something went wrong.";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-colors duration-300">
            <div className="bg-white dark:bg-[#0f0f0f] border border-neutral-200 dark:border-neutral-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative transition-colors duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-medium text-neutral-900 dark:text-neutral-100 mb-6">Add Manual Asset</h2>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-sm transition-colors duration-300">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Ticker/Symbol</label>
                            <input
                                required
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="e.g. AAPL"
                                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Asset Type</label>
                            <select
                                value={assetType}
                                onChange={(e) => setAssetType(e.target.value)}
                                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                            >
                                <option value="STOCK">Stock</option>
                                <option value="ETF">ETF</option>
                                <option value="CRYPTO">Crypto</option>
                                <option value="CASH">Cash</option>
                                <option value="REAL_ESTATE">Real Estate</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Asset Name (Optional)</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Apple Inc."
                            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Quantity</label>
                            <input
                                required
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Average Cost</label>
                            <input
                                required
                                type="number"
                                step="any"
                                value={averageCost}
                                onChange={(e) => setAverageCost(e.target.value)}
                                placeholder="150.00"
                                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Currency</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                            >
                                <option value="USD">USD</option>
                                <option value="CAD">CAD</option>
                                <option value="EUR">EUR</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-400">Institution</label>
                            <input
                                value={institution}
                                onChange={(e) => setInstitution(e.target.value)}
                                placeholder="e.g. Fidelity, Offline"
                                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors mr-3"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm dark:shadow-shadow-teal-900/20 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                "Save Asset"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
