import type { OrderItemInput } from "@/lib/types/orders";

export interface UnmatchedRequest {
  description: string;
  reason: string;
}

export interface ConversationDraft {
  conversation_id: string;
  source_hash: string;
  customer_name: string;
  delivery_address: string;
  items: OrderItemInput[];
  missing_information: string[];
  unmatched_requests: UnmatchedRequest[];
  updated_at: string;
}

export interface ConversationDraftResponse {
  draft: ConversationDraft | null;
  current_source_hash: string;
  source_changed: boolean;
}

export type ConversationDraftInput = Pick<
  ConversationDraft,
  "customer_name" | "delivery_address" | "items" | "missing_information" | "unmatched_requests"
>;

export interface CreateOrderFromDraftInput {
  acknowledge_stale_source: boolean;
}
