import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Product
from app.repositories.conversation_draft_repository import conversation_draft_repository
from app.repositories.order_repository import order_repository
from app.schemas.conversation_draft import (
    ConversationDraft as ConversationDraftSchema,
)
from app.schemas.conversation_draft import (
    ConversationDraftResponse,
    DraftEdit,
    ProposalOutput,
)
from app.schemas.order import OrderCreate, OrderResponse
from app.services.openai_proposal_generator import openai_proposal_generator
from app.services.order_service import order_service


class DraftNotFound(LookupError):
    pass


class InvalidDraftItem(ValueError):
    def __init__(self, product_id: str):
        self.product_id = product_id
        super().__init__(f"Producto fuera del catálogo: {product_id}")


class StaleDraft(ValueError):
    pass


def source_hash(conversation: dict) -> str:
    return hashlib.sha256(conversation["text"].encode("utf-8")).hexdigest()


class ConversationDraftService:
    def _response(
        self, db: Session, user_id: str, conversation: dict, conversation_id: str
    ) -> ConversationDraftResponse:
        current_hash = source_hash(conversation)
        draft = conversation_draft_repository.get(db, user_id, conversation_id)
        serialized = None
        if draft is not None:
            serialized = ConversationDraftSchema(
                conversation_id=draft.conversation_id,
                source_hash=draft.source_hash,
                updated_at=draft.updated_at,
                **draft.content,
            )
        return ConversationDraftResponse(
            draft=serialized,
            current_source_hash=current_hash,
            source_changed=draft is not None and draft.source_hash != current_hash,
        )

    def read(
        self, db: Session, user_id: str, conversation: dict, conversation_id: str
    ) -> ConversationDraftResponse:
        return self._response(db, user_id, conversation, conversation_id)

    def _validated_content(self, db: Session, payload: DraftEdit) -> dict:
        ids = {item.product_id for item in payload.items}
        products = db.scalars(select(Product.id).where(Product.id.in_(ids))).all() if ids else []
        unknown = ids - set(products)
        if unknown:
            raise InvalidDraftItem(min(unknown))
        return payload.model_dump(mode="json")

    def save(
        self,
        db: Session,
        user_id: str,
        conversation: dict,
        conversation_id: str,
        payload: DraftEdit,
    ) -> ConversationDraftResponse:
        try:
            draft = conversation_draft_repository.get_for_update(db, user_id, conversation_id)
            if draft is None:
                raise DraftNotFound(conversation_id)
            conversation_draft_repository.update_existing(
                draft, self._validated_content(db, payload)
            )
            db.commit()
            return self._response(db, user_id, conversation, conversation_id)
        except Exception:
            db.rollback()
            raise

    def generate(
        self, db: Session, user_id: str, conversation: dict, conversation_id: str
    ) -> ConversationDraftResponse:
        try:
            products = list(db.scalars(select(Product).order_by(Product.id)))
            proposal: ProposalOutput = openai_proposal_generator.generate(conversation, products)
            known_ids = {product.id for product in products}
            items = []
            unmatched = [item.model_dump(mode="json") for item in proposal.unmatched_requests]
            for item in proposal.items:
                if item.product_id in known_ids and item.quantity is not None:
                    items.append({"product_id": item.product_id, "quantity": item.quantity})
                else:
                    unmatched.append({
                        "description": item.description,
                        "reason": (
                            "El producto sugerido no existe en el catálogo actual."
                            if item.product_id not in known_ids
                            else "Falta confirmar la cantidad solicitada."
                        ),
                    })
            content = {
                "customer_name": proposal.customer_name,
                "delivery_address": proposal.delivery_address,
                "items": items,
                "missing_information": proposal.missing_information,
                "unmatched_requests": unmatched,
            }
            conversation_draft_repository.create_or_replace(
                db, user_id, conversation_id, source_hash(conversation), content
            )
            db.commit()
            return self._response(db, user_id, conversation, conversation_id)
        except Exception:
            db.rollback()
            raise

    def finalize(
        self,
        db: Session,
        user_id: str,
        conversation: dict,
        conversation_id: str,
        acknowledge_stale_source: bool,
    ) -> OrderResponse:
        try:
            draft = conversation_draft_repository.get_for_update(db, user_id, conversation_id)
            if draft is None:
                raise DraftNotFound(conversation_id)
            if draft.source_hash != source_hash(conversation) and not acknowledge_stale_source:
                raise StaleDraft(conversation_id)
            payload = OrderCreate.model_validate({
                "customer_name": draft.content["customer_name"],
                "delivery_address": draft.content["delivery_address"],
                "items": draft.content["items"],
            })
            order = order_service.build(db, user_id, payload)
            order_repository.stage(db, order)
            db.delete(draft)
            db.commit()
            db.refresh(order)
            return OrderResponse.model_validate(order)
        except Exception:
            db.rollback()
            raise


conversation_draft_service = ConversationDraftService()
