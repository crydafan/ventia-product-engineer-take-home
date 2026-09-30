from collections import Counter

from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem
from app.repositories.order_repository import order_repository
from app.schemas.order import OrderCreate

MAX_INTEGER = 2_147_483_647
MAX_BIGINT = 9_223_372_036_854_775_807


class UnknownProduct(ValueError):
    def __init__(self, product_id: str):
        self.product_id = product_id
        super().__init__(f"Producto fuera del catálogo: {product_id}")


class InvalidOrderItem(ValueError):
    def __init__(self, product_id: str, message: str):
        self.product_id = product_id
        super().__init__(message)


class OrderService:
    def build(self, db: Session, user_id: str, payload: OrderCreate) -> Order:
        """Construct an order from catalogue prices without writing to the database."""
        quantities: Counter[str] = Counter()
        for item in payload.items:
            quantities[item.product_id] += item.quantity
            if quantities[item.product_id] > MAX_INTEGER:
                raise InvalidOrderItem(item.product_id, "Cantidad excede el límite de Integer")
        products = order_repository.products(db, list(quantities))
        for product_id in quantities:
            if product_id not in products:
                raise UnknownProduct(product_id)
            if products[product_id].currency != "PEN":
                raise InvalidOrderItem(product_id, "La moneda del producto debe ser PEN")
        lines = []
        total_cents = 0
        for product_id, quantity in quantities.items():
            price_cents = products[product_id].price_cents
            if price_cents > MAX_BIGINT // quantity:
                raise InvalidOrderItem(product_id, "El importe de la línea excede BigInteger")
            line_total_cents = price_cents * quantity
            if line_total_cents > MAX_BIGINT - total_cents:
                raise InvalidOrderItem(product_id, "El total del pedido excede BigInteger")
            total_cents += line_total_cents
            lines.append(
                OrderItem(
                    product_id=product_id,
                    name=products[product_id].name,
                    quantity=quantity,
                    unit_price_cents=price_cents,
                    line_total_cents=line_total_cents,
                )
            )
        return Order(
            created_by=user_id,
            customer_name=payload.customer_name,
            delivery_address=payload.delivery_address,
            status="created",
            currency="PEN",
            items=lines,
            total_cents=total_cents,
        )

    def create(self, db: Session, user_id: str, payload: OrderCreate) -> Order:
        order = self.build(db, user_id, payload)
        try:
            return order_repository.save(db, order)
        except Exception:
            db.rollback()
            raise


order_service = OrderService()
