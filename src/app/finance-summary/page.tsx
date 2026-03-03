import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import FinanceSummaryClient from "./FinanceSummaryClient";

export default async function FinanceSummaryPage() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }

    return <FinanceSummaryClient />;
}
