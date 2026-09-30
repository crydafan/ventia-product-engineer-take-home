export interface Product { id: string; name: string; price_cents: number; currency: "PEN" }
export interface Customer { id: string; name: string }
export interface SampleConversation { id: string; title: string; customer_name: string; text: string }
export interface OrderItemInput { product_id: string; quantity: number }
export interface OrderInput {
  customer_name: string;
  delivery_address: string;
  items: OrderItemInput[];
}
export interface OrderLine extends OrderItemInput {
  name: string;
  unit_price_cents: number;
  line_total_cents: number;
}
export interface Order {
  id: string;
  number: string;
  created_at: string;
  status: "created";
  currency: "PEN";
  customer_name: string;
  delivery_address: string;
  items: OrderLine[];
  total_cents: number;
}
