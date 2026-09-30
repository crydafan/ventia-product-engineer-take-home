import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import auth


def signed_token(key, claims):
    return jwt.encode(claims, key, algorithm="EdDSA", headers={"kid": "test"})


def valid_claims():
    return {
        "sub": "user-a",
        "exp": int(time.time()) + 60,
        "iss": auth.settings.auth_issuer,
        "aud": auth.settings.auth_audience,
    }


def credentials(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.mark.parametrize(
    "change", [{"exp": 1}, {"iss": "wrong"}, {"aud": "wrong"}, {"sub": ""}]
)
def test_invalid_claims_are_rejected(monkeypatch, change):
    key = Ed25519PrivateKey.generate()
    claims = valid_claims() | change
    monkeypatch.setattr(
        auth.jwks_client, "get_signing_key_from_jwt", lambda _: SimpleNamespace(key=key.public_key())
    )
    with pytest.raises(HTTPException) as caught:
        auth.get_current_user_id(credentials(signed_token(key, claims)))
    assert caught.value.status_code == 401


def test_missing_auth_is_rejected():
    with pytest.raises(HTTPException) as caught:
        auth.get_current_user_id(None)
    assert caught.value.status_code == 401


def test_valid_token_returns_subject(monkeypatch):
    key = Ed25519PrivateKey.generate()
    monkeypatch.setattr(
        auth.jwks_client, "get_signing_key_from_jwt", lambda _: SimpleNamespace(key=key.public_key())
    )
    assert auth.get_current_user_id(credentials(signed_token(key, valid_claims()))) == "user-a"


def test_wrong_signature_is_rejected(monkeypatch):
    key = Ed25519PrivateKey.generate()
    other_key = Ed25519PrivateKey.generate()
    monkeypatch.setattr(
        auth.jwks_client, "get_signing_key_from_jwt", lambda _: SimpleNamespace(key=other_key.public_key())
    )
    with pytest.raises(HTTPException) as caught:
        auth.get_current_user_id(credentials(signed_token(key, valid_claims())))
    assert caught.value.status_code == 401


@pytest.mark.parametrize("claim", ["exp", "iss", "aud", "sub"])
def test_missing_claim_is_rejected(monkeypatch, claim):
    key = Ed25519PrivateKey.generate()
    claims = valid_claims()
    del claims[claim]
    monkeypatch.setattr(
        auth.jwks_client, "get_signing_key_from_jwt", lambda _: SimpleNamespace(key=key.public_key())
    )
    with pytest.raises(HTTPException) as caught:
        auth.get_current_user_id(credentials(signed_token(key, claims)))
    assert caught.value.status_code == 401


def test_jwks_connection_failure_returns_503(monkeypatch):
    from jwt.exceptions import PyJWKClientConnectionError

    def unavailable(_):
        raise PyJWKClientConnectionError("unavailable")

    monkeypatch.setattr(auth.jwks_client, "get_signing_key_from_jwt", unavailable)
    with pytest.raises(HTTPException) as caught:
        auth.get_current_user_id(credentials(signed_token(Ed25519PrivateKey.generate(), valid_claims())))
    assert caught.value.status_code == 503
