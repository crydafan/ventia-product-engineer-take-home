"use client";
import { useCallback, useState } from "react";
import { InboxClient } from "./inbox-client";
import { ConversationOrderClient } from "./conversation-order-client";
import type { SampleConversation } from "@/lib/types/orders";

export function WorkspaceClient() {
  const [selected, setSelected] = useState<SampleConversation | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const onConversationChange = useCallback((conversation: SampleConversation | null) => {
    setSelected(conversation);
  }, []);

  return <div className="relative h-full min-h-0">
    <InboxClient
      onConversationChange={onConversationChange}
      headerActions={<button type="button" disabled={!selected} onClick={() => setReviewOpen(true)} className="shrink-0 rounded-lg bg-volt px-3 py-2 text-xs font-semibold text-white hover:bg-marino disabled:cursor-not-allowed">Preparar pedido</button>}
    />
    <ConversationOrderClient conversation={selected} open={reviewOpen} onClose={() => setReviewOpen(false)} />
  </div>;
}
