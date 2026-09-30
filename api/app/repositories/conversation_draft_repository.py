from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.conversation_draft import ConversationDraft


class ConversationDraftRepository:
    def get(self, db: Session, user_id: str, conversation_id: str) -> ConversationDraft | None:
        return db.scalar(select(ConversationDraft).where(
            ConversationDraft.user_id == user_id,
            ConversationDraft.conversation_id == conversation_id,
        ))

    def get_for_update(self, db: Session, user_id: str, conversation_id: str) -> ConversationDraft | None:
        return db.scalar(select(ConversationDraft).where(
            ConversationDraft.user_id == user_id,
            ConversationDraft.conversation_id == conversation_id,
        ).with_for_update())

    def create_or_replace(self, db: Session, user_id: str, conversation_id: str,
                          source_hash: str, content: dict) -> ConversationDraft:
        statement = insert(ConversationDraft).values(
            id=str(uuid4()), user_id=user_id, conversation_id=conversation_id,
            source_hash=source_hash, content=content,
        ).on_conflict_do_update(
            constraint="uq_conversation_drafts_user_conversation",
            set_={"source_hash": source_hash, "content": content},
        ).returning(ConversationDraft)
        return db.scalar(statement)

    def update_existing(self, draft: ConversationDraft, content: dict) -> None:
        draft.content = content


conversation_draft_repository = ConversationDraftRepository()
