# Spike 05: API boundary and identity

## Scope and entry points

This slice follows the request boundary from FastAPI application setup through bearer-token validation and database-session injection. The main entry points are `api/app/main.py`, `api/app/api/routes.py`, `api/app/core/auth.py`, `api/app/core/config.py`, and `api/app/core/database.py`.

## Observed flow

1. `main.py` creates the FastAPI app, configures CORS for the configured web origin, permits `GET` and `POST`, and allows `Authorization` and `Content-Type` headers (`api/app/main.py:13-20`). It mounts the business router.
2. `/health` is registered directly on the app, outside the business router. It executes `SELECT 1` using the injected SQLAlchemy session and returns `503` on a database SQLAlchemy error (`api/app/main.py:23-29`).
3. The business router declares `Depends(get_current_user_id)` at router scope (`api/app/api/routes.py:17`). The dependency parses an optional HTTP Bearer credential and uses the configured JWKS endpoint to obtain a signing key (`api/app/core/auth.py:11-21`).
4. JWT verification accepts only `EdDSA`, checks configured issuer and audience, requires `exp`, `iss`, `aud`, and `sub`, and validates that `sub` is a nonblank string (`api/app/core/auth.py:22-33`). The returned subject string is the caller identity passed into order read/write handlers (`api/app/api/routes.py:43-45,52-61`).
5. SQLAlchemy configuration creates one engine with `pool_pre_ping=True`; `get_db` yields a session in a context manager (`api/app/core/database.py:11-17`). Settings are read by Pydantic Settings and include database URL, auth issuer/audience/JWKS URL, web origin, and seed settings (`api/app/core/config.py:4-14`).

The README describes the intended cross-service identity flow: the web obtains a JWT from the Better Auth session and sends it as `Authorization: Bearer <token>` to protected business routes (`README.md:115-127`). The Better Auth JWT config uses EdDSA/Ed25519, the same audience string, issuer from `BETTER_AUTH_URL`, and a five-minute token lifetime (`web/lib/auth.ts:7-23`). The API's default issuer and JWKS URL target the local web origin (`api/app/core/config.py:6-9`).

## Ownership and contracts

- Better Auth owns browser login/session handling and JWT issuance. The API does not look up the session in the auth database; it validates the token signature and claims using JWKS.
- The API owns authorization at the business boundary. Handlers use the verified token subject as `created_by`; the repository scopes order list/detail queries to that value (`api/app/repositories/order_repository.py:14-23`).
- CORS is an origin/browser policy at the API app boundary. It is configured for one `web_origin`, two methods, and two headers (`api/app/main.py:14-19`). It does not replace token validation.
- Database sessions are request dependencies. The auth identity dependency and DB session dependency are independently injected (`api/app/api/routes.py:18-19`).
- `/health` is intentionally a public app-level endpoint, while business endpoints inherit the router-wide auth dependency. The README calls health public (`README.md:119-127`).

## Failure states observed

- Missing bearer credentials produce `401` with a `WWW-Authenticate: Bearer` header (`api/app/core/auth.py:18-19`). Invalid signatures, expired tokens, wrong issuer/audience, or missing/invalid required claims produce `401` (`api/app/core/auth.py:22-39`).
- A JWKS connection error is distinguished from an invalid token and returns `503` (`api/app/core/auth.py:34-35`). The client can therefore encounter temporary identity-provider availability failures independently from rejected sessions.
- Database failure in the health query returns `503` (`api/app/main.py:24-29`). Other request database exceptions are not normalized here; they follow the framework/driver exception path.
- A web origin mismatch can prevent browser JavaScript from reading the API response even if the API and credentials work. The allowed methods/headers are currently a fixed allow-list.

## Verification seams

- `api/tests/test_auth.py` exercises valid identity extraction, missing credentials, invalid/missing claims, wrong signature, and JWKS connection failure (`api/tests/test_auth.py:30-91`). JWKS key retrieval is monkeypatched, so these tests verify claim/signature mapping without requiring a live Better Auth server.
- `api/tests/test_orders.py` verifies business routes reject unauthenticated requests and that different subjects see separate order data (`api/tests/test_orders.py:160-172`).
- `api/app/main.py` provides the health/database seam; an API-level check can verify the response under a working DB and the failure mapping when the DB query raises.
- Deployment configuration should be checked as a set: `BETTER_AUTH_URL`, API issuer, audience, JWKS URL, web origin, and the API's `DATABASE_URL` must agree with their service URLs and shared contract. The defaults alone only describe local development.

## Open questions

- Should `/health` remain a database-readiness probe, or should liveness and readiness be separate endpoints? Current `/health` requires a working DB.
- Is a five-minute JWT lifetime plus JWKS cache lifetime (300 seconds in `PyJWKClient`) the desired rotation/revocation behavior? The implementation verifies signatures but does not query an auth session for immediate revocation.
- Which production origins and proxy-facing issuer/JWKS URLs are authoritative? Only local defaults are visible in the settings class.
- Should API-wide exception handling normalize non-auth database outages into a stable response contract? The current explicit DB mapping covers only `/health`.
