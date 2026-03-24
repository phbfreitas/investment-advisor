import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <AuditClient />;
}
