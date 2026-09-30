from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, Sequence, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

order_number = Sequence("order_number_seq", schema="business", metadata=Base.metadata)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("price_cents >= 0"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    price_cents: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String, default="PEN")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (CheckConstraint("total_cents >= 0"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    sequence_no: Mapped[int] = mapped_column(
        BigInteger, order_number, server_default=order_number.next_value(), unique=True
    )
    created_by: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    status: Mapped[str] = mapped_column(String, default="created")
    currency: Mapped[str] = mapped_column(String, default="PEN")
    customer_name: Mapped[str] = mapped_column(String)
    delivery_address: Mapped[str] = mapped_column(String)
    total_cents: Mapped[int] = mapped_column(BigInteger)
    items: Mapped[list["OrderItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="OrderItem.id"
    )

    @property
    def number(self) -> str:
        return f"PED-{self.sequence_no:06d}"


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0"),
        CheckConstraint("unit_price_cents >= 0"),
        CheckConstraint("line_total_cents >= 0"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("business.orders.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(ForeignKey("business.products.id"))
    name: Mapped[str] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_cents: Mapped[int] = mapped_column(BigInteger)
    line_total_cents: Mapped[int] = mapped_column(BigInteger)
