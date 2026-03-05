"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Loader2, AlertCircle } from "lucide-react";

type HouseholdUser = {
    email: string;
    role: string;
    PK: string;
};

export default function HouseholdSettings() {
    const [users, setUsers] = useState<HouseholdUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviting, setIsInviting] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/household/users");
            const data = await res.json();
            if (data.users) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error("Failed to fetch household users:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: "", type: "" });

        if (!inviteEmail || !inviteEmail.includes("@")) {
            setMessage({ text: "Please enter a valid email address.", type: "error" });
            return;
        }

        setIsInviting(true);
        try {
            const res = await fetch("/api/household/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail }),
            });

            if (!res.ok) throw new Error("Failed to invite user");

            setMessage({ text: "User invited successfully! They will see your data when they log in.", type: "success" });
            setInviteEmail("");
            await fetchUsers(); // Refresh the list
        } catch (error) {
            setMessage({ text: "Error inviting user.", type: "error" });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemove = async (emailToRemove: string) => {
        if (!confirm(`Are you sure you want to remove ${emailToRemove} from your household? They will lose access to all shared data.`)) {
            return;
        }

        try {
            const res = await fetch("/api/household/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailToRemove }),
            });

            if (!res.ok) throw new Error("Failed to remove user");

            await fetchUsers();
        } catch (error) {
            setMessage({ text: "Error removing user.", type: "error" });
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600 dark:text-teal-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                    <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Household Sharing</h2>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                        Invite family members or co-pilots to share and manage this exact portfolio.
                    </p>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg flex items-center space-x-3 text-sm ${message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    <AlertCircle className="h-4 w-4 flex-none" />
                    <span>{message.text}</span>
                </div>
            )}

            {/* Invite Form */}
            <form onSubmit={handleInvite} className="flex gap-2">
                <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address to invite..."
                    className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
                <button
                    type="submit"
                    disabled={isInviting || !inviteEmail}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                    {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    <span>Invite</span>
                </button>
            </form>

            {/* Active Users Table */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-400">
                    <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-xs uppercase text-neutral-500 dark:text-neutral-500">
                        <tr>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900/20">
                        {users.map((u) => (
                            <tr key={u.PK} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                <td className="px-4 py-3 flex items-center gap-2">
                                    <span className="font-medium text-neutral-900 dark:text-neutral-200">{u.email}</span>
                                    {u.role === "ADMIN" && (
                                        <span className="text-[10px] uppercase font-bold tracking-wider bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full">
                                            Owner
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {u.role !== "ADMIN" && (
                                        <button
                                            onClick={() => handleRemove(u.email)}
                                            className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                                            title="Remove User"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-4 py-4 text-center text-neutral-500">
                                    No other users in this household.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
