import { authClient } from "@/lib/auth-client";
export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : "No se pudo completar la operación");
  }
}
export async function apiFetch<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, body?.detail ?? "Error de conexión");
  return body as T;
}
export async function withToken<T>(action: (token: string) => Promise<T>): Promise<T> {
  const { data, error } = await authClient.token();
  if (error || !data?.token) throw new ApiError(401, "Tu sesión expiró. Vuelve a ingresar.");
  return action(data.token);
}
