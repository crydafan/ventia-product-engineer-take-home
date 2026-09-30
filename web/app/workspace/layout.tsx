import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WorkspaceSidebarClient } from "./workspace-sidebar-client";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-noche md:flex-row">
    <WorkspaceSidebarClient />
    <div className="min-h-0 min-w-0 flex-1">{children}</div>
  </main>;
}
