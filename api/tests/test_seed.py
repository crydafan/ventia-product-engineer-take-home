import json
from pathlib import Path

from sqlalchemy import func, select

from app.core.config import settings
from app.models.order import Customer, Order, Product
from app.schemas.order import OrderCreate
from app.services.order_service import order_service
from scripts.seed import seed_business


def test_seed_is_repeatable_and_keeps_manual_orders(db):
    """Existing seed edits and manually created orders survive another run."""
    data = json.loads(Path(settings.seed_file).read_text())
    seed_business(db, data, "user-a")
    product = db.get(Product, data["products"][0]["id"])
    product.name = "Producto editado"
    product.price_cents = 4321
    seeded_order = db.get(Order, data["orders"][0]["id"])
    seeded_order.delivery_address = "Dirección editada"
    seeded_order.status = "confirmed"
    manual = order_service.build(
        db,
        "user-a",
        OrderCreate(
            customer_name="Manual",
            delivery_address="Calle Manual 1",
            items=[{"product_id": "gorra-azul", "quantity": 2}],
        ),
    )
    db.add(manual)
    db.flush()
    manual_id = manual.id
    seed_business(db, data, "user-a")
    assert db.scalar(select(func.count()).select_from(Product)) == 4
    assert db.scalar(select(func.count()).select_from(Customer)) == 3
    assert db.scalar(select(func.count()).select_from(Order)) == 3
    db.refresh(product)
    db.refresh(seeded_order)
    assert (product.name, product.price_cents) == ("Producto editado", 4321)
    assert (seeded_order.delivery_address, seeded_order.status) == (
        "Dirección editada",
        "confirmed",
    )
    assert db.get(Order, manual_id).total_cents == 6000
    assert {record["id"] for record in data["orders"]}.issubset(set(db.scalars(select(Order.id))))
