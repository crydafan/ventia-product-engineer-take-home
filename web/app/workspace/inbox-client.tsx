"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListClient } from "@/components/conversations/conversation-list-client";
import { MessageThread } from "@/components/conversations/message-thread";
import { normalizeSearch } from "@/lib/conversations";
import { ApiError, withToken } from "@/lib/services/api";
import { getSamples } from "@/lib/services/orders";
import type { SampleConversation } from "@/lib/types/orders";

interface InboxClientProps {
  onConversationChange?: (conversation: SampleConversation | null) => void;
  headerActions?: ReactNode;
}

export function InboxClient({ onConversationChange, headerActions }: InboxClientProps) {
  const [conversations, setConversations] = useState<SampleConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const requestId = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError(""); setExpired(false);
    try {
      const result = await withToken(getSamples);
      if (current !== requestId.current) return;
      setConversations(result);
      setSelectedId((id) => result.some((conversation) => conversation.id === id) ? id : result[0]?.id ?? null);
    } catch (caught) {
      if (current !== requestId.current) return;
      setExpired(caught instanceof ApiError && caught.status === 401);
      setError(caught instanceof ApiError && caught.status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : "No pudimos cargar las conversaciones.");
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const requests = requestId;
    return () => { active = false; requests.current++; };
  }, [load]);
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  useEffect(() => { onConversationChange?.(selected); }, [selected, onConversationChange]);
  useEffect(() => { if (showChat) heading.current?.focus(); }, [selectedId, showChat]);

  const search = normalizeSearch(query);
  const visible = conversations.filter((conversation) => normalizeSearch(`${conversation.customer_name} ${conversation.text}`).includes(search));

  function backToList() {
    setShowChat(false);
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus());
  }

  return <div className="flex h-full min-h-0 flex-col bg-white text-noche md:flex-row">
    <section ref={list} aria-label="Bandeja de conversaciones" className={`${showChat ? "hidden md:flex" : "flex"} min-h-0 flex-1 flex-col border-r border-slate-200 md:w-[330px] md:flex-none`}>
      {loading ? <div role="status" aria-busy="true"><span className="sr-only">Cargando conversaciones</span><div className="border-b border-slate-200 p-5"><h1 className="mb-5 text-xl font-semibold">Chats</h1><Skeleton className="h-10 w-full" /></div>{[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex gap-3 border-b border-slate-100 p-5"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div></div>)}</div> : error ? <div className="p-5 text-sm"><h1 className="mb-5 text-xl font-semibold">Chats</h1><p role="alert">{error}</p>
        {expired ? <Link href="/login" className="mt-4 block text-volt underline">Volver a ingresar</Link> : <button type="button" onClick={() => void load()} className="mt-4 text-volt underline">Reintentar</button>}</div>
        : conversations.length === 0 ? <div className="p-5"><h1 className="text-xl font-semibold">Chats</h1><p role="status" className="mt-5 text-sm">No hay conversaciones disponibles.</p></div>
        : <ConversationListClient conversations={visible} total={conversations.length} selectedId={selectedId} query={query} onQueryChange={setQuery}
          onSelect={(conversation) => { setSelectedId(conversation.id); setShowChat(true); }} />}
    </section>
    <div className={`${showChat ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}>
      <header className="flex min-h-[83px] flex-wrap items-center gap-3 border-b border-slate-200 bg-[#fafbfc] px-5 py-3 md:px-7">
        <button type="button" onClick={backToList} className="text-xs font-medium text-volt underline md:hidden">Volver a conversaciones</button>
        {selected && <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7edf7] text-xs font-semibold text-[#526987]">{selected.customer_name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("")}</span>}
        <div className="min-w-0 flex-1"><h2 tabIndex={-1} ref={heading} className="text-sm font-semibold">{selected?.customer_name ?? "Conversaciones"}</h2><p className="mt-1 text-[11px] text-slate-500">Conversación de muestra</p></div>
        {headerActions}
      </header>
      {loading ? <div aria-hidden="true" className="flex flex-1 flex-col gap-6 bg-slate-50 p-6 md:p-8">{[0, 1, 2, 3].map((item) => <div key={item} className={`w-4/5 max-w-sm rounded-2xl border border-slate-100 p-4 ${item % 2 ? "self-end bg-cielo/40" : "bg-white"}`}><Skeleton className="mb-2 h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>)}</div> : selected ? <MessageThread conversation={selected} /> : <p className="p-6 text-sm text-slate-500">Selecciona una conversación para ver sus mensajes.</p>}
    </div>
  </div>;
}
