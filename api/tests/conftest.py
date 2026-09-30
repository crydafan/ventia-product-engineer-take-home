import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.main import app as application
from app.models.order import Product


@pytest.fixture
def db():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url or make_url(url).database != "challenge_test":
        pytest.fail("TEST_DATABASE_URL debe apuntar exclusivamente a challenge_test")
    engine = create_engine(url)
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()
    engine.dispose()


@pytest.fixture
def app():
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(db, app):
    if db.get(Product, "polo-negro-m") is None:
        db.add(Product(id="polo-negro-m", name="Polo negro M", price_cents=4000, currency="PEN"))
        db.flush()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user_id] = lambda: "user-a"
    with TestClient(app) as client:
        yield client


@pytest.fixture
def unauthenticated_client(app):
    with TestClient(app) as client:
        yield client
