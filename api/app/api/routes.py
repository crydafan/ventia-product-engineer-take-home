import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.config import settings
from app.core.database import get_db
from app.models.order import Customer, Product
from app.repositories.order_repository import order_repository
from app.schemas.order import OrderCreate, OrderResponse
from app.services.order_service import InvalidOrderItem, UnknownProduct, order_service

router = APIRouter(dependencies=[Depends(get_current_user_id)])
Db = Annotated[Session, Depends(get_db)]
UserId = Annotated[str, Depends(get_current_user_id)]


@router.get("/products")
def products(db: Db) -> list[dict]:
    return [
        {"id": p.id, "name": p.name, "price_cents": p.price_cents, "currency": p.currency}
        for p in db.scalars(select(Product).order_by(Product.id))
    ]


@router.get("/customers")
def customers(db: Db) -> list[dict]:
    return [
        {"id": c.id, "name": c.name} for c in db.scalars(select(Customer).order_by(Customer.id))
    ]


@router.get("/sample-conversations")
def sample_conversations() -> list[dict]:
    return json.loads(Path(settings.seed_file).read_text())["conversations"]


@router.post("/orders", response_model=OrderResponse, status_code=201)
def create_order(payload: OrderCreate, db: Db, user_id: UserId) -> OrderResponse:
    try:
        return order_service.create(db, user_id, payload)
    except (UnknownProduct, InvalidOrderItem) as exc:
        raise HTTPException(
            422, {"field": "items", "product_id": exc.product_id, "message": str(exc)}
        ) from exc


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(db: Db, user_id: UserId) -> list[OrderResponse]:
    return order_repository.list(db, user_id)


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: str, db: Db, user_id: UserId) -> OrderResponse:
    order = order_repository.get(db, user_id, order_id)
    if order is None:
        raise HTTPException(404, "Pedido no encontrado")
    return order
