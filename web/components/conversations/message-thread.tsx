import { conversationMessages } from "@/lib/conversations";
import type { SampleConversation } from "@/lib/types/orders";

export function MessageThread({ conversation }: { conversation: SampleConversation }) {
  return <section aria-label={`Mensajes de ${conversation.customer_name}`} className="flex min-h-0 flex-1 flex-col">
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f0f0f0] px-5 py-8 lg:px-[8%]">
      {conversationMessages(conversation.text).map((message) => <div key={message.id}
        className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-[13px] leading-[1.65] shadow-sm md:max-w-[83%] ${message.sender === "sales" ? "self-end rounded-[11px_0_11px_11px] bg-cielo" : "self-start rounded-[0_11px_11px_11px] bg-white"}`}>
        <span className="sr-only">{message.sender === "sales" ? "Ventas: " : "Cliente: "}</span>{message.text}
      </div>)}
    </div>
    <p className="flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-4 text-xs text-slate-500">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-current stroke-[1.7]"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
      Conversación de muestra · los mensajes son de solo lectura
    </p>
  </section>;
}
