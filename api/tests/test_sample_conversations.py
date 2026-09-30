from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id


def test_samples_preserve_identity_name_and_original_messages(app):
    app.dependency_overrides[get_current_user_id] = lambda: "user-a"
    with TestClient(app) as client:
        response = client.get("/sample-conversations")
    assert response.status_code == 200
    samples = response.json()
    assert [(s["id"], s["customer_name"]) for s in samples] == [
        ("clear", "Lucía Ramos"),
        ("correction", "Diego Soto"),
        ("missing", "Andrea Pérez"),
    ]
    assert "Perdón, mejor uno negro y uno blanco" in samples[1]["text"]
    assert "la dirección de la vez pasada" in samples[2]["text"]


def test_samples_require_authentication(unauthenticated_client):
    assert unauthenticated_client.get("/sample-conversations").status_code == 401
