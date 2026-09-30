"""Insert fictional business examples without changing existing records."""

import json
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.order import Customer, Order, Product
from app.schemas.order import OrderCreate
from app.services.order_service import order_service


def seed_business(db: Session, data: dict, user_id: str) -> None:
    for model, records in ((Product, data["products"]), (Customer, data["customers"])):
        for record in records:
            db.execute(insert(model).values(**record).on_conflict_do_nothing(index_elements=["id"]))
    for record in data["orders"]:
        if db.scalar(select(Order.id).where(Order.id == record["id"])) is not None:
            continue
        payload = OrderCreate(**{key: value for key, value in record.items() if key != "id"})
        order = order_service.build(db, user_id, payload)
        order.id = record["id"]
        db.add(order)
    db.flush()


def main() -> None:
    data = json.loads(Path(settings.seed_file).read_text())
    with SessionLocal.begin() as db:
        user_id = db.scalar(
            text('SELECT id FROM public."user" WHERE email = :email'),
            {"email": settings.seed_email},
        )
        if user_id is None:
            raise RuntimeError("Ejecuta init:auth antes de la semilla de negocio")
        seed_business(db, data, user_id)


if __name__ == "__main__":
    main()
