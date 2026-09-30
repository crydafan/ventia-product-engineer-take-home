from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from app.core.config import settings

bearer = HTTPBearer(auto_error=False)
jwks_client = PyJWKClient(settings.auth_jwks_url, timeout=5, lifespan=300)


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    if credentials is None:
        raise HTTPException(401, "Inicia sesión", headers={"WWW-Authenticate": "Bearer"})
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["EdDSA"],
            audience=settings.auth_audience,
            issuer=settings.auth_issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        subject = payload["sub"]
        if not isinstance(subject, str) or not subject.strip():
            raise jwt.InvalidTokenError("Invalid subject")
        return subject
    except PyJWKClientConnectionError as exc:
        raise HTTPException(503, "Autenticación temporalmente no disponible") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            401, "Sesión inválida o expirada", headers={"WWW-Authenticate": "Bearer"}
        ) from exc
