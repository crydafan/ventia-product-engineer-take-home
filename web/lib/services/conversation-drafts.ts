import { apiFetch } from "@/lib/services/api";
import type { Order } from "@/lib/types/orders";
import type {
  ConversationDraftInput,
  ConversationDraftResponse,
  CreateOrderFromDraftInput,
} from "@/lib/types/conversation-drafts";

const pathFor = (conversationId: string) =>
  `/conversation-drafts/${encodeURIComponent(conversationId)}`;

export const getConversationDraft = (token: string, conversationId: string) =>
  apiFetch<ConversationDraftResponse>(token, pathFor(conversationId));

export const generateConversationDraft = (token: string, conversationId: string) =>
  apiFetch<ConversationDraftResponse>(token, `${pathFor(conversationId)}/generate`, { method: "POST" });

export const saveConversationDraft = (
  token: string,
  conversationId: string,
  input: ConversationDraftInput,
) => apiFetch<ConversationDraftResponse>(token, pathFor(conversationId), {
  method: "PUT",
  body: JSON.stringify(input),
});

export const createOrderFromDraft = (
  token: string,
  conversationId: string,
  input: CreateOrderFromDraftInput,
) => apiFetch<Order>(token, `${pathFor(conversationId)}/create-order`, {
  method: "POST",
  body: JSON.stringify(input),
});
