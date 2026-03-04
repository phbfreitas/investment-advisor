import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GuidanceClient from "./GuidanceClient";

export default async function GuidancePage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    return <GuidanceClient />;
}
