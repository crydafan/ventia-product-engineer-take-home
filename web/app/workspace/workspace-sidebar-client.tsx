"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { VentiaLogo } from "@/components/ventia-logo";
import { authClient } from "@/lib/auth-client";

export function WorkspaceSidebarClient() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) { setError("No se pudo cerrar sesión."); return; }
      router.replace("/login");
      router.refresh();
    } catch { setError("No se pudo cerrar sesión."); }
    finally { setLoggingOut(false); }
  }

  const links = [
    { href: "/workspace", label: "Conversaciones", active: pathname === "/workspace", path: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z M7 9h9 M7 13h6" },
    { href: "/workspace/orders", label: "Pedidos", active: pathname.startsWith("/workspace/orders"), path: "M5 4h14v17l-3-2-4 2-4-2-3 2V4Z M9 9h6 M9 13h6 M9 1v5 M15 1v5" },
  ];

  return <aside className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:w-[210px] md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:px-3 md:py-6">
    <div className="md:mb-7 md:ml-3"><VentiaLogo /></div>
    <div className="hidden rounded-lg border border-slate-200 px-3 py-3 text-[13px] md:mx-1 md:mb-7 md:block"><p className="font-semibold">Tienda Demo</p><p className="mt-1 text-xs text-slate-500">Entorno de prueba</p></div>
    <nav aria-label="Navegación principal" className="order-last flex w-full gap-2 md:order-none md:block">
      <p className="mb-3 hidden px-3 text-[10px] font-semibold tracking-[0.13em] text-slate-400 md:block">PLATAFORMA</p>
      {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold md:mb-1 md:justify-start md:gap-3 ${link.active ? "bg-cielo text-volt" : "text-slate-600 hover:bg-slate-50"}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-current stroke-[1.7]"><path d={link.path} /></svg>{link.label}
      </Link>)}
    </nav>
    <div className="flex items-center gap-2 md:mt-auto md:border-t md:border-slate-200 md:px-1 md:pt-5">
      <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-full bg-[#e3f4fa] text-xs font-semibold text-[#187f9f] md:grid">CD</span>
      <div><p className="hidden text-sm font-medium md:block">Candidato</p>
        <button type="button" disabled={loggingOut} onClick={() => void logout()} className="text-xs text-marino underline md:mt-1">{loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button>
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  </aside>;
}
