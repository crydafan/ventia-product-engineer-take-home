from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order, Product


class OrderRepository:
    def products(self, db: Session, ids: list[str]) -> dict[str, Product]:
        return {
            product.id: product
            for product in db.scalars(select(Product).where(Product.id.in_(ids)))
        }

    def get(self, db: Session, user_id: str, order_id: str) -> Order | None:
        return db.scalar(select(Order).where(Order.id == order_id, Order.created_by == user_id))

    def list(self, db: Session, user_id: str) -> list[Order]:
        return list(
            db.scalars(
                select(Order)
                .where(Order.created_by == user_id)
                .order_by(Order.created_at.desc(), Order.id.desc())
            )
        )

    def save(self, db: Session, order: Order) -> Order:
        db.add(order)
        db.commit()
        db.refresh(order)
        return order


order_repository = OrderRepository()
