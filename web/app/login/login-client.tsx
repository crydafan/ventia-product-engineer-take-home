"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VentiaLogo } from "@/components/ventia-logo";
import { authClient } from "@/lib/auth-client";

export function LoginClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="flex min-h-screen items-center justify-center bg-cielo/35 px-5 py-12">
    <div className="w-full max-w-md">
      <div className="mb-8"><VentiaLogo /></div>
      <form className="rounded-2xl border border-marino/10 bg-white p-7 shadow-xl shadow-marino/5 sm:p-9" onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const values = new FormData(event.currentTarget);
        setBusy(true); setError("");
        try {
          const result = await authClient.signIn.email({
            email: String(values.get("email")), password: String(values.get("password")),
          });
          if (result.error) { setError("No pudimos iniciar sesión. Revisa tus datos."); return; }
          router.replace("/workspace"); router.refresh();
        } catch { setError("No pudimos conectar. Inténtalo nuevamente."); }
        finally { setBusy(false); }
      }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-volt">Prueba Product Engineer</p>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Ingresar a VentIA</h1>
        <p className="mb-8 text-sm leading-6 text-marino/70">Accede al espacio de trabajo con las credenciales del entorno de prueba.</p>
        <div className="grid gap-5">
          <label className="text-sm font-medium">Correo
            <Input name="email" type="email" required autoComplete="username" />
          </label>
          <label className="text-sm font-medium">Contraseña
            <Input name="password" type="password" required autoComplete="current-password" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-2 w-full">{busy ? "Ingresando…" : "Ingresar"}</Button>
        </div>
      </form>
    </div>
  </main>;
}
