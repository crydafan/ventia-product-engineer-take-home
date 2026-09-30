# Spike 01: Runtime and startup topology

## Scope and summary

This slice follows the supplied local runtime from configuration through service readiness. The application runs three long-lived Compose services—PostgreSQL, FastAPI, and Next.js—plus a one-shot Better Auth initializer. PostgreSQL is the shared database server, while Better Auth owns its auth tables and the API owns business tables in the `business` schema. The web app and API communicate over HTTP; the web app is the browser-facing entry point.

No services were started as part of this inspection.

## Entry points and startup flow

1. The root `README.md` documents the standard path: copy `.env.example` to `.env`, then run `docker compose up --build` ([README.md:60-69](../../README.md#L60-L69)). The sample environment defines local ports, the Better Auth origin/secret, demo credentials, public API URL, and optional empty AI settings ([.env.example:1-17](../../.env.example#L1-L17)).
2. Compose starts PostgreSQL 16 with a named persistent data volume, binds its host port to loopback, and gates dependents on `pg_isready` ([compose.yaml:11-26](../../compose.yaml#L11-L26)).
3. `auth-init` builds the web image and runs `pnpm init:auth` after the database is healthy ([compose.yaml:28-33](../../compose.yaml#L28-L33)). `web/scripts/init-auth.ts` runs Better Auth migrations and creates the configured demo account only when the email is absent; the one-shot process closes its PostgreSQL pool on completion ([web/scripts/init-auth.ts:5-27](../../web/scripts/init-auth.ts#L5-L27)).
4. The API waits for that one-shot service to complete successfully, applies Alembic migrations, runs the business seed script, and then starts Uvicorn with reload enabled ([compose.yaml:35-61](../../compose.yaml#L35-L61)). The API image is Python 3.12 with a frozen `uv` environment ([api/Dockerfile:1-10](../../api/Dockerfile#L1-L10)); dependencies are declared in `api/pyproject.toml` ([api/pyproject.toml:1-28](../../api/pyproject.toml#L1-L28)).
5. The web container waits for the API health check, installs workspace dependencies from the lockfile, and runs Next.js dev server on container port 3000 ([compose.yaml:63-83](../../compose.yaml#L63-L83)). Its image uses Node 22 and pnpm ([web/Dockerfile:1-10](../../web/Dockerfile#L1-L10); [package.json:1](../../package.json#L1)).

Compose mounts `./api` into `/app` and the seed directory read-only into the API. For the web service, the repository is mounted at `/workspace`, with named volumes for root/web modules, pnpm store, and `.next`; the database volume is separately named ([compose.yaml:20-21](../../compose.yaml#L20-L21), [compose.yaml:52-54](../../compose.yaml#L52-L54), [compose.yaml:71-90](../../compose.yaml#L71-L90)). `docker compose down` retains the database volume, while `down -v` removes it per the README ([README.md:60-69](../../README.md#L60-L69)).

The documented local-development alternative uses the same PostgreSQL service, but runs `init:auth`, Alembic, business seeding, Uvicorn, and Next.js as separate host commands with host-oriented URLs ([README.md:70-102](../../README.md#L70-L102)). This is a distinct startup path worth keeping in mind when comparing service DNS names with `localhost` configuration.

## Ownership and contracts

- **Compose / environment:** Compose wires ports, environment variables, named volumes, and readiness dependencies. `.env.example` is the checked-in template; actual `.env` is intentionally local-only ([README.md:60-69](../../README.md#L60-L69)). `BETTER_AUTH_URL` must match the externally visible web origin, and `NEXT_PUBLIC_API_URL` points the browser-side API client at the API host ([.env.example:2-13](../../.env.example#L2-L13)).
- **Authentication persistence:** Better Auth connects with `AUTH_DATABASE_URL` through a direct `pg.Pool` in `web/lib/auth.ts` ([web/lib/auth.ts:1-5](../../web/lib/auth.ts#L1-L5)). Compose points this at the shared database service ([compose.yaml:3-9](../../compose.yaml#L3-L9)). The auth initializer owns Better Auth table setup and demo-user creation.
- **Business persistence:** The API uses SQLAlchemy with `DATABASE_URL`, `pool_pre_ping=True`, and a session dependency that scopes sessions with a context manager ([api/app/core/database.py:1-17](../../api/app/core/database.py#L1-L17)). Its declarative metadata sets the schema to `business` ([api/app/core/database.py:7-9](../../api/app/core/database.py#L7-L9)); the API startup command runs Alembic and its seed before serving ([compose.yaml:49](../../compose.yaml#L49)).
- **API readiness:** FastAPI's `/health` runs `SELECT 1`; it returns 503 for a SQLAlchemy failure and `{"status":"ok"}` when the database responds ([api/app/main.py:23-29](../../api/app/main.py#L23-L29)). The Compose API health check calls that route ([compose.yaml:57-61](../../compose.yaml#L57-L61)).
- **Web readiness:** Next.js `/api/health` returns a static `{"status":"ok"}` without probing the API or database ([web/app/api/health/route.ts:1-3](../../web/app/api/health/route.ts#L1-L3)); Compose uses it for the web container health check ([compose.yaml:79-83](../../compose.yaml#L79-L83)).
- **Auth verification dependency:** Compose configures the API's issuer and JWKS URL from Better Auth, and the API reads issuer, audience, JWKS URL, web origin, and DB URL in `Settings` ([compose.yaml:37-44](../../compose.yaml#L37-L44); [api/app/core/config.py:1-14](../../api/app/core/config.py#L1-L14)). The API can become healthy before the web process is ready because its health route checks only the database; JWT verification will need the web JWKS endpoint at request time ([api/app/main.py:23-29](../../api/app/main.py#L23-L29); [api/app/core/auth.py:11-12](../../api/app/core/auth.py#L11-L12)).

## Failure states and observed recovery boundaries

- A failed PostgreSQL health check prevents `auth-init` from running. An auth migration or account-creation error exits `auth-init` nonzero and blocks API startup because Compose requires successful completion ([compose.yaml:28-33](../../compose.yaml#L28-L33); [web/scripts/init-auth.ts:22-27](../../web/scripts/init-auth.ts#L22-L27)).
- An Alembic or seed failure stops the API shell command before Uvicorn is executed; the API health check consequently never passes, leaving the dependent web service waiting ([compose.yaml:49-61](../../compose.yaml#L49-L61)).
- The API health route explicitly returns 503 for database query errors. The web health route only proves Next.js can serve that route; it says nothing about API reachability or auth/database availability ([api/app/main.py:23-29](../../api/app/main.py#L23-L29); [web/app/api/health/route.ts:1-3](../../web/app/api/health/route.ts#L1-L3)).
- The API's JWKS client has a 5-second connection timeout and 300-second key cache. On JWKS connection failure auth-dependent requests map to 503; invalid JWTs map to 401 ([api/app/core/auth.py:11-12](../../api/app/core/auth.py#L11-L12), [api/app/core/auth.py:34-39](../../api/app/core/auth.py#L34-L39)). This is request-time dependency behavior rather than an API health condition.
- AI provider keys and model selection are passed as optional variables with empty defaults in Compose, and the README states startup does not require them ([compose.yaml:45-48](../../compose.yaml#L45-L48); [README.md:60-69](../../README.md#L60-L69)).

## Verification seams

These are inspection points, not checks run during the spike:

- Reproduce the normal initialization order with `cp .env.example .env` and `docker compose up --build`; inspect Compose service status and logs for `db`, `auth-init`, `api`, and `web` ([README.md:60-69](../../README.md#L60-L69)).
- Verify API readiness independently at `http://localhost:8100/health` and the web process at `http://localhost:3100/api/health`; the API check includes DB connectivity while the web check is static ([api/app/main.py:23-29](../../api/app/main.py#L23-L29); [web/app/api/health/route.ts:1-3](../../web/app/api/health/route.ts#L1-L3)).
- For host-local mode, follow the separate env exports and startup commands in README ([README.md:70-102](../../README.md#L70-L102)); verify both `AUTH_DATABASE_URL` and `DATABASE_URL` target the local forwarded port.
- Existing API tests are under `api/tests/`; startup-specific checks could focus on migration/seed idempotency and readiness semantics, but this spike did not add or execute tests.

## Open questions

- Is production or deployment topology in scope, or should this spike document only the provided local Docker and local-host modes? No production deployment config was found in the inspected file tree.
- Should the web health check remain process-only, or should readiness report dependency reachability separately? Current endpoint is static.
- Should API readiness include JWKS reachability? Current API health checks PostgreSQL only, while JWKS is deferred until an authenticated request.
- The web Dockerfile declares an image-level dev command, while Compose overrides it with dependency installation followed by the dev server. Is that distinction intentional for this take-home image, or is a production image path expected later? ([web/Dockerfile:8-10](../../web/Dockerfile#L8-L10); [compose.yaml:63-66](../../compose.yaml#L63-L66))
