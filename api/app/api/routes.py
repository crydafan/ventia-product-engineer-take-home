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
from app.schemas.conversation_draft import (
    ConversationDraftResponse,
    DraftEdit,
    FinalizeDraftRequest,
)
from app.schemas.order import OrderCreate, OrderResponse
from app.services.conversation_draft_service import (
    DraftNotFound,
    InvalidDraftItem,
    StaleDraft,
    conversation_draft_service,
)
from app.services.openai_proposal_generator import ProposalGenerationError
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


def _conversation_sources() -> list[dict]:
    return json.loads(Path(settings.seed_file).read_text())["conversations"]


@router.get("/sample-conversations")
def sample_conversations() -> list[dict]:
    return _conversation_sources()


def _conversation_source(conversation_id: str) -> dict:
    conversation = next(
        (row for row in _conversation_sources() if row["id"] == conversation_id), None
    )
    if conversation is None:
        raise HTTPException(404, "Conversación no encontrada")
    return conversation


@router.get("/conversation-drafts/{conversation_id}", response_model=ConversationDraftResponse)
def get_conversation_draft(conversation_id: str, db: Db, user_id: UserId):
    conversation = _conversation_source(conversation_id)
    return conversation_draft_service.read(db, user_id, conversation, conversation_id)


@router.put("/conversation-drafts/{conversation_id}", response_model=ConversationDraftResponse)
def save_conversation_draft(
    conversation_id: str, payload: DraftEdit, db: Db, user_id: UserId
) -> ConversationDraftResponse:
    conversation = _conversation_source(conversation_id)
    try:
        return conversation_draft_service.save(db, user_id, conversation, conversation_id, payload)
    except DraftNotFound as exc:
        raise HTTPException(404, "Borrador no encontrado") from exc
    except InvalidDraftItem as exc:
        raise HTTPException(422, {"field": "items", "product_id": exc.product_id}) from exc


@router.post(
    "/conversation-drafts/{conversation_id}/generate",
    response_model=ConversationDraftResponse,
)
def generate_conversation_draft(conversation_id: str, db: Db, user_id: UserId):
    conversation = _conversation_source(conversation_id)
    try:
        return conversation_draft_service.generate(db, user_id, conversation, conversation_id)
    except ProposalGenerationError as exc:
        raise HTTPException(502, "No se pudo generar la propuesta. Puedes volver a intentar.") from exc


@router.post(
    "/conversation-drafts/{conversation_id}/create-order",
    response_model=OrderResponse,
    status_code=201,
)
def create_order_from_draft(
    conversation_id: str,
    db: Db,
    user_id: UserId,
    payload: FinalizeDraftRequest,
) -> OrderResponse:
    conversation = _conversation_source(conversation_id)
    try:
        return conversation_draft_service.finalize(
            db, user_id, conversation, conversation_id, payload.acknowledge_stale_source
        )
    except DraftNotFound as exc:
        raise HTTPException(404, "Borrador no encontrado") from exc
    except StaleDraft as exc:
        raise HTTPException(409, "La conversación cambió; confirma que deseas continuar.") from exc
    except (UnknownProduct, InvalidOrderItem) as exc:
        raise HTTPException(
            422, {"field": "items", "product_id": exc.product_id, "message": str(exc)}
        ) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


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
