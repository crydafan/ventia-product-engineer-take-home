"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, withToken } from "@/lib/services/api";
import {
  createOrderFromDraft,
  generateConversationDraft,
  getConversationDraft,
  saveConversationDraft,
} from "@/lib/services/conversation-drafts";
import { getProducts } from "@/lib/services/orders";
import type { ConversationDraft, ConversationDraftInput, ConversationDraftResponse } from "@/lib/types/conversation-drafts";
import type { Order, Product, SampleConversation } from "@/lib/types/orders";

interface ConversationOrderClientProps {
  conversation: SampleConversation | null;
  open: boolean;
  onClose: () => void;
}

type SaveQueue = {
  timer?: ReturnType<typeof setTimeout>;
  latest: ConversationDraftInput;
  version: number;
  savedVersion: number;
  running?: Promise<void>;
};

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const formatPrice = (cents: number) => money.format(cents / 100);

function editable(draft: ConversationDraft): ConversationDraftInput {
  return {
    customer_name: draft.customer_name,
    delivery_address: draft.delivery_address,
    items: draft.items.map((item) => ({ ...item })),
    missing_information: [...draft.missing_information],
    unmatched_requests: draft.unmatched_requests.map((item) => ({ ...item })),
  };
}

export function ConversationOrderClient({ conversation, open, onClose }: ConversationOrderClientProps) {
  const [drafts, setDrafts] = useState<Record<string, ConversationDraftResponse>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, "saved" | "saving" | "error">>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState("");
  const [generation, setGeneration] = useState<Record<string, boolean>>({});
  const [generationErrors, setGenerationErrors] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState<Record<string, boolean>>({});
  const [finalizeErrors, setFinalizeErrors] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [staleAcknowledged, setStaleAcknowledged] = useState<Record<string, boolean>>({});
  const queues = useRef(new Map<string, SaveQueue>());
  const currentId = conversation?.id;
  const response = currentId ? drafts[currentId] : undefined;
  const draft = response?.draft ?? null;
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const total = draft?.items.reduce((sum, item) => sum + (productById.get(item.product_id)?.price_cents ?? 0) * item.quantity, 0) ?? 0;

  const updateResponse = useCallback((id: string, result: ConversationDraftResponse) => {
    setDrafts((previous) => ({ ...previous, [id]: result }));
    setLoaded((previous) => ({ ...previous, [id]: true }));
  }, []);

  const flushSave = useCallback(async (id: string) => {
    const queue = queues.current.get(id);
    if (!queue) return;
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = undefined;
    }
    if (queue.running) {
      await queue.running;
      if (queue.savedVersion < queue.version) return flushSave(id);
      return;
    }
    if (queue.savedVersion >= queue.version) return;
    queue.running = (async () => {
      while (queue.savedVersion < queue.version) {
        const version = queue.version;
        const body = queue.latest;
        setSaveStates((previous) => ({ ...previous, [id]: "saving" }));
        const result = await withToken((token) => saveConversationDraft(token, id, body));
        queue.savedVersion = version;
        updateResponse(id, result);
      }
      setSaveStates((previous) => ({ ...previous, [id]: "saved" }));
    })();
    try {
      await queue.running;
    } catch (error) {
      setSaveStates((previous) => ({ ...previous, [id]: "error" }));
      throw error;
    } finally {
      queue.running = undefined;
    }
    if (queue.savedVersion < queue.version) return flushSave(id);
  }, [updateResponse]);

  const scheduleSave = useCallback((id: string, input: ConversationDraftInput) => {
    let queue = queues.current.get(id);
    if (!queue) {
      queue = { latest: input, version: 0, savedVersion: 0 };
      queues.current.set(id, queue);
    }
    queue.latest = input;
    queue.version += 1;
    setSaveStates((previous) => ({ ...previous, [id]: "saving" }));
    if (queue.timer) clearTimeout(queue.timer);
    queue.timer = setTimeout(() => { void flushSave(id).catch(() => undefined); }, 400);
  }, [flushSave]);

  useEffect(() => {
    if (!open || !currentId || loaded[currentId]) return;
    let active = true;
    setLoadErrors((previous) => ({ ...previous, [currentId]: "" }));
    void withToken((token) => getConversationDraft(token, currentId)).then((result) => {
      if (active) updateResponse(currentId, result);
    }).catch((error: unknown) => {
      if (!active) return;
      const status = error instanceof ApiError ? error.status : 0;
      setLoadErrors((previous) => ({
        ...previous,
        [currentId]: status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : "No pudimos cargar el borrador.",
      }));
    });
    return () => { active = false; };
  }, [currentId, loaded, open, updateResponse]);

  useEffect(() => {
    if (!open || products.length || productsError) return;
    let active = true;
    void withToken(getProducts).then((result) => {
      if (active) setProducts(result);
    }).catch(() => {
      if (active) setProductsError("No pudimos cargar el catálogo para mostrar precios.");
    });
    return () => { active = false; };
  }, [open, products.length, productsError]);

  useEffect(() => () => {
    for (const queue of queues.current.values()) if (queue.timer) clearTimeout(queue.timer);
  }, []);

  function editDraft(update: (current: ConversationDraftInput) => ConversationDraftInput) {
    if (!currentId || !draft || generation[currentId] || finalizing[currentId]) return;
    const next = update(editable(draft));
    setDrafts((previous) => {
      const current = previous[currentId];
      if (!current?.draft) return previous;
      return { ...previous, [currentId]: { ...current, draft: { ...current.draft, ...next } } };
    });
    scheduleSave(currentId, next);
  }

  async function runGeneration() {
    if (!currentId || generation[currentId] || finalizing[currentId]) return;
    if (draft && !window.confirm("¿Regenerar la propuesta? Se reemplazará el borrador actual solo si la generación termina correctamente.")) return;
    setGeneration((previous) => ({ ...previous, [currentId]: true }));
    setGenerationErrors((previous) => ({ ...previous, [currentId]: "" }));
    try {
      await flushSave(currentId);
      const result = await withToken((token) => generateConversationDraft(token, currentId));
      updateResponse(currentId, result);
      const queue = queues.current.get(currentId);
      if (queue) {
        queue.latest = result.draft ? editable(result.draft) : queue.latest;
        queue.version = queue.savedVersion = 0;
      }
      setSaveStates((previous) => ({ ...previous, [currentId]: "saved" }));
    } catch (error) {
      setGenerationErrors((previous) => ({
        ...previous,
        [currentId]: error instanceof ApiError && error.status === 401
          ? "Tu sesión expiró. Vuelve a ingresar."
          : "No se pudo generar la propuesta. Tus cambios guardados siguen disponibles; puedes reintentar.",
      }));
    } finally {
      setGeneration((previous) => ({ ...previous, [currentId]: false }));
    }
  }

  async function createOrder() {
    if (!currentId || !draft || finalizing[currentId] || !draft.customer_name.trim() || !draft.delivery_address.trim() || !draft.items.length) return;
    if (response?.source_changed && !staleAcknowledged[currentId]) return;
    setFinalizing((previous) => ({ ...previous, [currentId]: true }));
    setFinalizeErrors((previous) => ({ ...previous, [currentId]: "" }));
    try {
      await flushSave(currentId);
      const order = await withToken((token) => createOrderFromDraft(token, currentId, {
        acknowledge_stale_source: Boolean(response?.source_changed && staleAcknowledged[currentId]),
      }));
      setOrders((previous) => ({ ...previous, [currentId]: order }));
      setDrafts((previous) => ({ ...previous, [currentId]: { ...previous[currentId], draft: null } }));
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      setFinalizeErrors((previous) => ({
        ...previous,
        [currentId]: status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : "No se pudo crear el pedido. El borrador sigue disponible; revisa e inténtalo de nuevo.",
      }));
    } finally {
      setFinalizing((previous) => ({ ...previous, [currentId]: false }));
    }
  }

  if (!open || !conversation) return null;
  const id = conversation.id;
  const busy = Boolean(generation[id] || finalizing[id]);
  const statusText = saveStates[id] === "saving" ? "Guardando…" : saveStates[id] === "error" ? "No se guardó. Se reintentará al cambiar." : saveStates[id] === "saved" ? "Guardado" : "";

  return <>
    <button type="button" aria-label="Cerrar panel de pedido" onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/35" />
    <aside role="dialog" aria-modal="true" aria-labelledby="conversation-order-title" className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:max-w-xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div><p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">REVISIÓN DE PEDIDO</p><h2 id="conversation-order-title" className="mt-1 text-lg font-semibold">{conversation.customer_name}</h2><p className="mt-1 text-xs text-slate-500">Revisa los datos y productos antes de crear el pedido.</p></div>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Cerrar</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {orders[id] ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="font-semibold text-emerald-950">Pedido creado</h3><p className="mt-2 text-sm text-emerald-900">Se creó el pedido {orders[id].number} por {formatPrice(orders[id].total_cents)}.</p><Link className="mt-4 inline-block font-semibold text-volt underline" href={`/workspace/orders/${encodeURIComponent(orders[id].id)}`}>Ver pedido →</Link></div>
        : loadErrors[id] ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">{loadErrors[id]}<button type="button" onClick={() => { setLoaded((previous) => ({ ...previous, [id]: false })); setLoadErrors((previous) => ({ ...previous, [id]: "" })); }} className="ml-2 font-semibold underline">Reintentar</button></div>
        : !loaded[id] ? <p role="status" className="py-8 text-center text-sm text-slate-500">Cargando borrador…</p>
        : !draft ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center"><h3 className="font-semibold">Aún no hay propuesta</h3><p className="mt-2 text-sm text-slate-500">Genera un borrador desde esta conversación y revisa cada dato.</p><button type="button" disabled={busy} onClick={() => void runGeneration()} className="mt-5 rounded-lg bg-volt px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{generation[id] ? "Generando…" : "Generar propuesta"}</button>{generationErrors[id] && <p role="alert" className="mt-4 text-sm text-rose-700">{generationErrors[id]} <button type="button" onClick={() => void runGeneration()} className="font-semibold underline">Reintentar</button></p>}</div>
        : <div className="space-y-5">
          {response?.source_changed && <section className="rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 className="text-sm font-semibold text-amber-950">La conversación cambió</h3><p className="mt-1 text-sm text-amber-900">Este borrador se generó desde una versión anterior. Puedes regenerarlo o continuar tras reconocer el aviso.</p><button type="button" disabled={busy} onClick={() => void runGeneration()} className="mt-3 text-sm font-semibold text-amber-950 underline">Regenerar propuesta</button><label className="mt-3 flex items-start gap-2 text-sm text-amber-950"><input type="checkbox" checked={Boolean(staleAcknowledged[id])} onChange={(event) => setStaleAcknowledged((previous) => ({ ...previous, [id]: event.target.checked }))} /><span>Entiendo que el borrador usa una versión anterior de la conversación y quiero continuar.</span></label></section>}
          {draft.missing_information.length > 0 && <section className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-semibold">Información pendiente</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{draft.missing_information.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
          {draft.unmatched_requests.length > 0 && <section className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-semibold">Solicitudes sin producto asociado</h3><ul className="mt-2 space-y-2 text-sm">{draft.unmatched_requests.map((item, index) => <li key={`${item.description}-${index}`}><strong>{item.description}</strong><span className="block text-slate-600">{item.reason}</span></li>)}</ul></section>}
          <section className="space-y-3"><h3 className="text-sm font-semibold">Datos de entrega</h3><label className="block text-xs font-medium text-slate-600">Nombre del cliente<input value={draft.customer_name} disabled={busy} onChange={(event) => editDraft((current) => ({ ...current, customer_name: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-noche" /></label><label className="block text-xs font-medium text-slate-600">Dirección de entrega<textarea value={draft.delivery_address} disabled={busy} rows={3} onChange={(event) => editDraft((current) => ({ ...current, delivery_address: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-noche" /></label></section>
          <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Productos</h3><button type="button" disabled={busy || !products.length} onClick={() => editDraft((current) => ({ ...current, items: [...current.items, { product_id: products[0].id, quantity: 1 }] }))} className="text-xs font-semibold text-volt underline">Agregar producto</button></div>
            {draft.items.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Agrega al menos un producto del catálogo.</p> : <ul className="space-y-3">{draft.items.map((item, index) => {
              const product = productById.get(item.product_id);
              return <li key={`${item.product_id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_76px_auto] items-end gap-2 rounded-lg border border-slate-200 p-3"><label className="min-w-0 text-xs font-medium text-slate-600">Producto<select value={item.product_id} disabled={busy} onChange={(event) => editDraft((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, product_id: event.target.value } : line) }))} className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-noche">{products.map((option) => <option key={option.id} value={option.id}>{option.name} · {formatPrice(option.price_cents)}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Cantidad<input type="number" min={1} step={1} value={item.quantity} disabled={busy} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1) editDraft((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, quantity } : line) })); }} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-noche" /></label><button type="button" aria-label={`Quitar ${product?.name ?? "producto"}`} disabled={busy} onClick={() => editDraft((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }))} className="rounded-md px-2 py-2 text-xs text-rose-700 underline">Quitar</button>{product && <p className="col-span-3 text-right text-xs text-slate-500">Subtotal {formatPrice(product.price_cents * item.quantity)}</p>}</li>;
            })}</ul>}
            {productsError ? <p role="alert" className="mt-3 text-sm text-rose-700">{productsError}</p> : <p className="mt-3 text-right text-xs text-slate-500">Precios del catálogo</p>}
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold"><span>Total estimado</span><span className="tabular-nums">{formatPrice(total)}</span></div>
          </section>
          <p role="status" className="min-h-5 text-xs text-slate-500">{statusText}</p>
          {generationErrors[id] && <p role="alert" className="text-sm text-rose-700">{generationErrors[id]} <button type="button" onClick={() => void runGeneration()} className="font-semibold underline">Reintentar</button></p>}
          {finalizeErrors[id] && <p role="alert" className="text-sm text-rose-700">{finalizeErrors[id]}</p>}
          {(!draft.customer_name.trim() || !draft.delivery_address.trim() || !draft.items.length) && <p className="text-xs text-slate-500">Completa nombre, dirección y al menos un producto para crear el pedido.</p>}
          <button type="button" disabled={busy || !draft.customer_name.trim() || !draft.delivery_address.trim() || !draft.items.length || (Boolean(response?.source_changed) && !staleAcknowledged[id]) || Boolean(productsError)} onClick={() => void createOrder()} className="w-full rounded-lg bg-volt px-4 py-3 text-sm font-semibold text-white hover:bg-marino disabled:opacity-50">{finalizing[id] ? "Creando pedido…" : "Crear pedido"}</button>
        </div>}
      </div>
    </aside>
  </>;
}
