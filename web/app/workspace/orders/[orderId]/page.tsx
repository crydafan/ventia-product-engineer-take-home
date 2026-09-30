import { OrdersClient } from "../orders-client";

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrdersClient orderId={orderId} />;
}
