import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GlobalRadarClient from "./GlobalRadarClient";

export default async function GlobalRadarPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    return <GlobalRadarClient />;
}
