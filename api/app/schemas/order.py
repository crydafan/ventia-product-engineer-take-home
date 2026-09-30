from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Quantity = Annotated[int, Field(strict=True, gt=0, le=2_147_483_647)]


class ItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: Text = Field(description="ID del catálogo")
    quantity: Quantity = Field(description="Cantidad entera positiva")


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_name: Text = Field(description="Nombre revisado del cliente")
    delivery_address: Text = Field(description="Dirección revisada de entrega")
    items: list[ItemCreate] = Field(min_length=1, description="Productos a crear")


class OrderLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    quantity: int
    name: str
    unit_price_cents: int
    line_total_cents: int


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    number: str
    created_at: datetime
    status: Literal["created"]
    currency: Literal["PEN"]
    customer_name: str
    delivery_address: str
    items: list[OrderLineResponse]
    total_cents: int
