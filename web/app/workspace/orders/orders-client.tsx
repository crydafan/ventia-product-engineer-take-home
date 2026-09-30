"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OrdersSkeleton } from "./orders-skeleton";
import { Input } from "@/components/ui/input";
import { normalizeSearch } from "@/lib/conversations";
import { ApiError, withToken } from "@/lib/services/api";
import { getOrder, getOrders } from "@/lib/services/orders";
import type { Order } from "@/lib/types/orders";

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const date = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
const price = (cents: number) => money.format(cents / 100);

export function OrdersClient({ orderId }: { orderId?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError(""); setExpired(false); setNotFound(false);
    try {
      const result = await withToken(async (token) => orderId ? [await getOrder(token, orderId)] : getOrders(token));
      if (current !== requestId.current) return;
      setOrders(result);
    } catch (caught) {
      if (current !== requestId.current) return;
      const status = caught instanceof ApiError ? caught.status : 0;
      setExpired(status === 401);
      setNotFound(status === 404);
      setError(status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : status === 404 ? "El pedido no existe o no está disponible para tu usuario." : "No pudimos cargar los pedidos. Inténtalo nuevamente.");
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const requests = requestId;
    return () => { active = false; requests.current++; };
  }, [load]);

  const search = normalizeSearch(query);
  const visible = orders.filter((order) => normalizeSearch(`${order.number} ${order.customer_name}`).includes(search));
  const order = orderId ? orders[0] : undefined;

  return <section aria-label={orderId ? "Detalle del pedido" : "Listado de pedidos"} className="h-full overflow-y-auto bg-[#f8fafc]">
    <div className="mx-auto max-w-6xl px-5 py-7 md:px-9 md:py-9">
      {orderId && <Link href="/workspace/orders" className="mb-5 inline-block text-sm font-medium text-volt hover:underline">← Volver a pedidos</Link>}
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-500">TIENDA DEMO / PEDIDOS</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{orderId ? notFound ? "Pedido no encontrado" : !loading && !error && order ? `Pedido ${order.number}` : "Detalle del pedido" : "Pedidos"}</h1>
          <p className="mt-2 text-sm text-slate-500">{orderId ? "Consulta los datos guardados al crear este pedido." : "Todos los pedidos que has creado, en un solo lugar."}</p>
        </div>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>Actualizar</Button>
      </header>

      {loading ? <OrdersSkeleton detail={Boolean(orderId)} />
        : error ? <div className="rounded-xl border border-slate-200 bg-white p-8"><p role="alert" className="text-sm">{error}</p>
          {expired ? <Link href="/login" className="mt-4 inline-block text-sm text-volt underline">Volver a ingresar</Link> : !notFound && <Button type="button" variant="outline" className="mt-4" onClick={() => void load()}>Reintentar</Button>}</div>
        : orderId && order ? <>
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="rounded-md bg-cielo px-2.5 py-1 font-semibold text-marino">Creado</span><time dateTime={order.created_at}>{date.format(new Date(order.created_at))} · Perú</time></div>
          <div className="mb-6 grid gap-5 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Cliente</h2><p className="break-words font-semibold">{order.customer_name}</p></article>
            <article className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Dirección de entrega</h2><p className="whitespace-pre-wrap break-words text-sm">{order.delivery_address}</p></article>
          </div>
          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-6 py-5 text-base font-semibold">Productos del pedido</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">Productos, cantidades y precios guardados</caption>
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="px-6 py-3 font-medium">Producto</th><th scope="col" className="px-4 py-3 text-right font-medium">Cantidad</th><th scope="col" className="px-4 py-3 text-right font-medium">Precio unitario</th><th scope="col" className="px-6 py-3 text-right font-medium">Subtotal</th></tr></thead>
              <tbody>{order.items.map((item) => <tr key={item.product_id} className="border-t border-slate-100"><th scope="row" className="px-6 py-5 font-medium">{item.name}</th><td className="px-4 py-5 text-right tabular-nums">{item.quantity}</td><td className="whitespace-nowrap px-4 py-5 text-right tabular-nums">{price(item.unit_price_cents)}</td><td className="whitespace-nowrap px-6 py-5 text-right font-medium tabular-nums">{price(item.line_total_cents)}</td></tr>)}</tbody>
            </table></div>
            <dl className="ml-auto max-w-sm space-y-3 px-6 py-6"><div className="flex justify-between text-sm text-slate-500"><dt>Envío</dt><dd>Gratis</dd></div><div className="flex items-center justify-between border-t border-slate-200 pt-4"><dt className="font-semibold">Total</dt><dd className="text-2xl font-semibold tracking-tight text-marino tabular-nums">{price(order.total_cents)}</dd></div></dl>
          </article><p className="mt-4 text-xs text-slate-500">El estado Creado confirma el registro del pedido. No indica pago, facturación ni despacho.</p>
        </> : <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div className="w-full max-w-sm"><label htmlFor="order-search" className="mb-2 block text-xs font-medium text-slate-600">Buscar pedido</label><Input id="order-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Número de pedido o cliente" /></div><p role="status" className="text-xs text-slate-500">{visible.length} de {orders.length} pedidos</p></div>
          {orders.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><h2 className="text-lg font-semibold">Aún no hay pedidos</h2><p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Los pedidos que crees desde una conversación aparecerán aquí.</p><Link href="/workspace" className="mt-5 inline-block text-sm font-semibold text-volt hover:underline">Ir a conversaciones →</Link></div>
          : visible.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm">No se encontraron pedidos.</p><button type="button" className="mt-3 text-sm text-volt underline" onClick={() => setQuery("")}>Limpiar búsqueda</button></div>
          : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div aria-hidden="true" className="hidden grid-cols-[1.1fr_1.3fr_.6fr_.6fr_.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-medium text-slate-500 md:grid"><span>Pedido / Fecha</span><span>Cliente</span><span>Unidades</span><span>Estado</span><span className="text-right">Total</span></div>
            <ul>{visible.map((item) => <li key={item.id} className="border-b border-slate-100 last:border-b-0"><Link href={`/workspace/orders/${encodeURIComponent(item.id)}`} aria-label={`Ver pedido ${item.number} de ${item.customer_name}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-5 transition-colors hover:bg-cielo/30 md:grid-cols-[1.1fr_1.3fr_.6fr_.6fr_.7fr] md:gap-4 md:px-6">
              <div className="min-w-0"><span className="break-words text-sm font-semibold text-volt">{item.number}</span><time dateTime={item.created_at} className="mt-1 block text-[11px] text-slate-500">{date.format(new Date(item.created_at))}</time></div>
              <span className="order-3 min-w-0 break-words text-sm font-medium md:order-none">{item.customer_name}</span>
              <span className="hidden text-sm text-slate-500 md:block">{item.items.reduce((sum, line) => sum + line.quantity, 0)}</span>
              <span className="order-4 justify-self-end rounded-md bg-cielo px-2 py-1 text-[11px] font-medium text-marino md:order-none md:justify-self-start">Creado</span>
              <span className="text-right text-sm font-semibold tabular-nums md:order-none">{price(item.total_cents)} <span aria-hidden="true" className="ml-1 text-slate-400">→</span></span>
            </Link></li>)}</ul></div>}
          <p className="mt-4 text-xs text-slate-500">Importes en soles (PEN). Fechas en horario de Perú. Usa Actualizar para consultar los últimos pedidos guardados.</p>
        </>}
    </div>
  </section>;
}
