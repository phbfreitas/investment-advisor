import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export default async function Page() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    return <HomeClient />;
}
