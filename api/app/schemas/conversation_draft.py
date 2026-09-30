from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

DraftText = Annotated[str, StringConstraints(max_length=4000)]
CatalogId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
PositiveQuantity = Annotated[int, Field(strict=True, gt=0, le=2_147_483_647)]


class DraftItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: CatalogId
    quantity: PositiveQuantity


class UnmatchedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: DraftText
    reason: DraftText


class DraftEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_name: DraftText
    delivery_address: DraftText
    items: list[DraftItem] = Field(max_length=100)
    missing_information: list[DraftText] = Field(max_length=100)
    unmatched_requests: list[UnmatchedRequest] = Field(max_length=100)


class ConversationDraft(DraftEdit):
    conversation_id: str
    source_hash: str
    updated_at: datetime


class ConversationDraftResponse(BaseModel):
    draft: ConversationDraft | None
    current_source_hash: str
    source_changed: bool


class FinalizeDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    acknowledge_stale_source: bool = False


class ProposedItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: CatalogId | None
    description: DraftText
    quantity: PositiveQuantity | None


class ProposalOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_name: DraftText
    delivery_address: DraftText
    items: list[ProposedItem] = Field(max_length=100)
    missing_information: list[DraftText] = Field(max_length=100)
    unmatched_requests: list[UnmatchedRequest] = Field(max_length=100)
