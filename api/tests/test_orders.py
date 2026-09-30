import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.models.order import Order, Product
from app.schemas.order import OrderCreate
from app.services.order_service import order_service

VALID_ORDER = {
    "customer_name": "Ana",
    "delivery_address": "Calle 1",
    "items": [{"product_id": "polo-negro-m", "quantity": 1}],
}


@pytest.mark.parametrize("quantity", [0, -1, 1.5, True, "2", 2_147_483_648])
def test_quantity_must_be_positive_integer(quantity):
    with pytest.raises(ValidationError):
        OrderCreate(
            **{**VALID_ORDER, "items": [{"product_id": "polo-negro-m", "quantity": quantity}]}
        )


@pytest.mark.parametrize("field", ["customer_name", "delivery_address"])
def test_blank_required_text_is_rejected(field):
    with pytest.raises(ValidationError):
        OrderCreate(**{**VALID_ORDER, field: "   "})


def test_server_consolidates_and_prices_order(client, db):
    response = client.post(
        "/orders",
        json={
            **VALID_ORDER,
            "items": [
                {"product_id": "polo-negro-m", "quantity": 1},
                {"product_id": "polo-negro-m", "quantity": 2},
            ],
        },
    )
    assert response.status_code == 201
    order = response.json()
    assert order["total_cents"] == 12000
    assert order["number"].startswith("PED-")
    assert order["currency"] == "PEN"
    assert len(order["items"]) == 1
    assert order["items"][0]["quantity"] == 3
    assert order["items"][0]["unit_price_cents"] == 4000
    db.expire_all()
    assert client.get(f"/orders/{order['id']}").json() == order


def test_unknown_product_does_not_write_partial_order(client):
    before = client.get("/orders").json()
    response = client.post(
        "/orders",
        json={
            **VALID_ORDER,
            "items": [
                {"product_id": "polo-negro-m", "quantity": 1},
                {"product_id": "not-in-catalog", "quantity": 1},
            ],
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["product_id"] == "not-in-catalog"
    assert client.get("/orders").json() == before


def test_non_pen_product_does_not_create_mislabeled_order(client, db):
    db.add(Product(id="foreign-product", name="Foreign", price_cents=500, currency="USD"))
    db.flush()
    before = client.get("/orders").json()
    response = client.post(
        "/orders",
        json={
            **VALID_ORDER,
            "items": [
                {"product_id": "polo-negro-m", "quantity": 1},
                {"product_id": "foreign-product", "quantity": 1},
            ],
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["product_id"] == "foreign-product"
    assert client.get("/orders").json() == before


def test_quantity_above_integer_limit_does_not_write(client):
    before = client.get("/orders").json()
    response = client.post(
        "/orders",
        json={
            **VALID_ORDER,
            "items": [{"product_id": "polo-negro-m", "quantity": 2_147_483_648}],
        },
    )
    assert response.status_code == 422
    assert client.get("/orders").json() == before


@pytest.mark.parametrize(
    ("items", "product_prices", "rejected_product"),
    [
        (
            [
                {"product_id": "polo-negro-m", "quantity": 2_147_483_647},
                {"product_id": "polo-negro-m", "quantity": 1},
            ],
            {},
            "polo-negro-m",
        ),
        (
            [{"product_id": "polo-negro-m", "quantity": 2}],
            {"polo-negro-m": 9_223_372_036_854_775_807},
            "polo-negro-m",
        ),
        (
            [
                {"product_id": "polo-negro-m", "quantity": 1},
                {"product_id": "expensive-product", "quantity": 1},
            ],
            {"polo-negro-m": 9_223_372_036_854_775_807, "expensive-product": 1},
            "expensive-product",
        ),
    ],
)
def test_database_numeric_overflow_returns_422_without_writes(
    client, db, items, product_prices, rejected_product
):
    for product_id, price_cents in product_prices.items():
        product = db.get(Product, product_id)
        if product is None:
            db.add(Product(id=product_id, name=product_id, price_cents=price_cents, currency="PEN"))
        else:
            product.price_cents = price_cents
    db.flush()
    before = client.get("/orders").json()
    response = client.post("/orders", json={**VALID_ORDER, "items": items})
    assert response.status_code == 422
    assert response.json()["detail"]["product_id"] == rejected_product
    assert client.get("/orders").json() == before


def test_prices_cannot_be_supplied_by_caller(client):
    response = client.post("/orders", json={**VALID_ORDER, "total_cents": 1})
    assert response.status_code == 422
    response = client.post(
        "/orders",
        json={
            **VALID_ORDER,
            "items": [
                {"product_id": "polo-negro-m", "quantity": 1, "unit_price_cents": 1},
            ],
        },
    )
    assert response.status_code == 422


def test_other_user_cannot_read_order(client, app):
    from app.core.auth import get_current_user_id

    order = client.post("/orders", json=VALID_ORDER).json()
    app.dependency_overrides[get_current_user_id] = lambda: "user-b"
    assert client.get(f"/orders/{order['id']}").status_code == 404
    assert client.get("/orders").json() == []


def test_business_routes_require_auth(unauthenticated_client):
    for path in ("/products", "/customers", "/sample-conversations", "/orders"):
        assert unauthenticated_client.get(path).status_code == 401
    assert unauthenticated_client.post("/orders", json=VALID_ORDER).status_code == 401


def test_build_does_not_persist_order(db, client):
    before = list(db.scalars(select(Order)))
    order = order_service.build(db, "user-a", OrderCreate(**VALID_ORDER))
    assert order.total_cents == 4000
    assert order.items[0].line_total_cents == 4000
    assert list(db.scalars(select(Order))) == before


def test_catalogue_endpoint_exposes_server_price(client):
    response = client.get("/products")
    assert response.status_code == 200
    assert {product["id"]: product["price_cents"] for product in response.json()}[
        "polo-negro-m"
    ] == 4000
