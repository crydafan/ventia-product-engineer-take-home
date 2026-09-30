"use client";
import { conversationMessages } from "@/lib/conversations";
import type { SampleConversation } from "@/lib/types/orders";

interface ConversationListProps {
  conversations: SampleConversation[];
  total: number;
  selectedId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (conversation: SampleConversation) => void;
}

export function ConversationListClient({ conversations, total, selectedId, query, onQueryChange, onSelect }: ConversationListProps) {
  return <>
    <div className="border-b border-slate-200">
      <div className="px-5 pb-4 pt-6">
        <h1 className="mb-5 text-[21px] font-semibold tracking-tight">Chats <span className="ml-1 rounded bg-slate-100 px-2 py-1 align-middle text-xs font-medium text-slate-500">{total}</span></h1>
        <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-2.5 text-slate-400" htmlFor="chat-search">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-current stroke-2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input id="chat-search" aria-label="Buscar conversación" value={query} onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar conversación" className="min-w-0 flex-1 bg-transparent text-xs text-noche outline-none placeholder:text-slate-400" />
        </label>
      </div>
      <p className="px-5 pb-3 text-xs text-slate-500">Todas las conversaciones</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {conversations.map((conversation) => {
        const initials = conversation.customer_name.split(/\s+/).map((word) => word[0]).slice(0, 2).join("");
        const messages = conversationMessages(conversation.text);
        const preview = messages.findLast((message) => message.sender === "customer")?.text ?? messages.at(-1)?.text ?? "Sin mensajes";
        return <button type="button" key={conversation.id} aria-label={`Abrir conversación con ${conversation.customer_name}`}
          aria-pressed={selectedId === conversation.id} onClick={() => onSelect(conversation)}
          className={`flex w-full gap-3 border-b border-slate-100 px-5 py-5 text-left shadow-[inset_3px_0_transparent] transition-colors ${selectedId === conversation.id ? "bg-[#eef5ff] shadow-[inset_3px_0_var(--volt)]" : "hover:bg-slate-50"}`}>
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7edf7] text-xs font-semibold text-[#526987]">{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">{conversation.customer_name}</span>
            <span className="mt-2 block truncate text-xs text-slate-500">{preview}</span>
            <span className="mt-2 block text-[11px] text-[#258263]">Conversación de muestra</span>
          </span>
        </button>;
      })}
      {conversations.length === 0 && <div className="p-5 text-sm text-slate-600"><p>No se encontraron conversaciones.</p>
        {query && <button type="button" onClick={() => onQueryChange("")} className="mt-3 font-semibold text-volt underline">Limpiar búsqueda</button>}</div>}
    </div>
    <p className="border-t border-slate-200 px-5 py-4 text-[11px] text-slate-500">{total} conversaciones de ejemplo</p>
  </>;
}
