import { apiFetch } from "@/lib/services/api";
import type { Product, Order, OrderInput, Customer, SampleConversation } from "@/lib/types/orders";
export const getProducts = (accessToken: string) => apiFetch<Product[]>(accessToken, "/products");
export const getCustomers = (accessToken: string) => apiFetch<Customer[]>(accessToken, "/customers");
export const getSamples = (accessToken: string) => apiFetch<SampleConversation[]>(accessToken, "/sample-conversations");
export const getOrders = (accessToken: string) => apiFetch<Order[]>(accessToken, "/orders");
export const getOrder = (accessToken: string, id: string) =>
  apiFetch<Order>(accessToken, `/orders/${encodeURIComponent(id)}`);
export const createOrder = (accessToken: string, input: OrderInput) =>
  apiFetch<Order>(accessToken, "/orders", { method: "POST", body: JSON.stringify(input) });
