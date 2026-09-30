# Spike 02: Web shell and session

## Scope and summary

This slice traces the Next.js route shell, workspace navigation, Better Auth browser/server integration, and how the web session becomes API authorization. The root route forwards to the workspace; the workspace layout performs a server-side session check before rendering its sidebar and route content. The login and logout actions use the Better Auth React client. Business API requests fetch a JWT through that client and attach it as a bearer token.

## Route and component entry points

- `web/app/layout.tsx` is the root document shell. It sets Spanish document language and global CSS, but does not perform authentication ([web/app/layout.tsx:1-9](../../web/app/layout.tsx#L1-L9)).
- `web/app/page.tsx` redirects `/` to `/workspace` ([web/app/page.tsx:1-2](../../web/app/page.tsx#L1-L2)).
- `/login` renders `LoginClient`, which is a client component containing the email/password form ([web/app/login/page.tsx:1-2](../../web/app/login/page.tsx#L1-L2); [web/app/login/login-client.tsx:1-16](../../web/app/login/login-client.tsx#L1-L16)).
- `web/app/workspace/layout.tsx` is the common authenticated layout for the workspace route tree. It reads request headers, asks Better Auth for the session, redirects to `/login` when no session exists, then renders the sidebar and child page ([web/app/workspace/layout.tsx:1-12](../../web/app/workspace/layout.tsx#L1-L12)).
- `/workspace` mounts `WorkspaceClient`, which mounts the inbox client ([web/app/workspace/page.tsx:1-2](../../web/app/workspace/page.tsx#L1-L2); [web/app/workspace/workspace-client.tsx:1-6](../../web/app/workspace/workspace-client.tsx#L1-L6)). The orders list and detail routes both render `OrdersClient` underneath the same workspace layout ([web/app/workspace/orders/page.tsx:1-5](../../web/app/workspace/orders/page.tsx#L1-L5); [web/app/workspace/orders/[orderId]/page.tsx:1-6](../../web/app/workspace/orders/%5BorderId%5D/page.tsx#L1-L6)).
- `WorkspaceSidebarClient` owns links between conversations and orders and the logout control ([web/app/workspace/workspace-sidebar-client.tsx:9-31](../../web/app/workspace/workspace-sidebar-client.tsx#L9-L31)).

## Session ownership and login flow

1. `web/lib/auth.ts` constructs Better Auth with a direct `pg.Pool` using `AUTH_DATABASE_URL`, the configured base URL and secret, and the trusted origin ([web/lib/auth.ts:1-13](../../web/lib/auth.ts#L1-L13)). It disables signup by default through `createAuth(allowSignUp = false)`.
2. The JWT plugin uses EdDSA/Ed25519 and issues tokens with issuer from `BETTER_AUTH_URL`, audience `ventia-challenge-api`, and a 5-minute expiration ([web/lib/auth.ts:14-24](../../web/lib/auth.ts#L14-L24)). The same module exports the server auth instance ([web/lib/auth.ts:27](../../web/lib/auth.ts#L27)).
3. Better Auth's catch-all Next.js route exposes `GET` and `POST` handlers at `/api/auth/*` ([web/app/api/auth/[...all]/route.ts:1-5](../../web/app/api/auth/%5B...all%5D/route.ts#L1-L5)).
4. The client library uses `createAuthClient` and the `jwtClient` plugin ([web/lib/auth-client.ts:1-4](../../web/lib/auth-client.ts#L1-L4)). Login submits email and password to `authClient.signIn.email`; known credential failures show a generic message, thrown network errors show a connection message, and successful login replaces the route with `/workspace` then refreshes server-rendered state ([web/app/login/login-client.tsx:16-28](../../web/app/login/login-client.tsx#L16-L28)).
5. The workspace layout performs the authoritative route-gate check by calling `auth.api.getSession` with incoming headers ([web/app/workspace/layout.tsx:6-12](../../web/app/workspace/layout.tsx#L6-L12)). All workspace child routes share this gate.
6. Logout calls `authClient.signOut`; on success it replaces the route with `/login` and refreshes the route state. A returned error or thrown error is surfaced as “No se pudo cerrar sesión.” ([web/app/workspace/workspace-sidebar-client.tsx:15-26](../../web/app/workspace/workspace-sidebar-client.tsx#L15-L26)).

The `auth-init` container runs Better Auth migrations and seeds a single configured candidate account when missing; that path uses `createAuth(true)` only for initial account signup while the app's exported instance remains signup-disabled ([web/scripts/init-auth.ts:5-19](../../web/scripts/init-auth.ts#L5-L19); [web/lib/auth.ts:7-13](../../web/lib/auth.ts#L7-L13)). The checked-in credentials are demo values for local exercise use ([.env.example:9-12](../../.env.example#L9-L12)).

## Web-to-API authorization contract

The browser obtains an access token via `authClient.token()` in `withToken`. Missing token or client-side token error becomes an `ApiError(401, "Tu sesión expiró...")` ([web/lib/services/api.ts:20-24](../../web/lib/services/api.ts#L20-L24)). `apiFetch` sets JSON content type, attaches `Authorization: Bearer ...`, disables fetch caching, parses JSON defensively, and converts non-2xx responses into `ApiError` with the API `detail` when available ([web/lib/services/api.ts:7-18](../../web/lib/services/api.ts#L7-L18)). The URL is built from `NEXT_PUBLIC_API_URL` plus the requested path, so the request originates in the browser rather than being proxied through a Next.js route ([web/lib/services/api.ts:7-15](../../web/lib/services/api.ts#L7-L15)).

On the API side, `HTTPBearer` extracts the token. `PyJWKClient` obtains the signing key from the configured JWKS URL, and PyJWT enforces EdDSA, issuer, audience, and required `exp`, `iss`, `aud`, and `sub` claims; the non-empty string `sub` is returned as user identity ([api/app/core/auth.py:11-33](../../api/app/core/auth.py#L11-L33)). Missing credentials and invalid/expired tokens map to 401; inability to contact the JWKS endpoint maps to 503 ([api/app/core/auth.py:18-19](../../api/app/core/auth.py#L18-L19); [api/app/core/auth.py:34-39](../../api/app/core/auth.py#L34-L39)).

This means two related but distinct checks exist: the web route layout asks Better Auth for a session cookie, while API business calls require a signed JWT. A valid route session alone is not enough if token issuance or API verification fails. The public health endpoints are not evidence of an authenticated session: the API `/health` checks database connectivity only ([api/app/main.py:23-29](../../api/app/main.py#L23-L29)), and web `/api/health` is a static process response ([web/app/api/health/route.ts:1-3](../../web/app/api/health/route.ts#L1-L3)).

## Failure states and boundaries

- Unauthenticated navigation to any `/workspace` descendant is redirected to `/login` by the shared server layout ([web/app/workspace/layout.tsx:6-12](../../web/app/workspace/layout.tsx#L6-L12)). The `/login` page itself has no observed redirect for already-authenticated users.
- Login distinguishes returned auth errors (generic credential message) from thrown errors (connection message). It disables repeat submission while busy ([web/app/login/login-client.tsx:11-12](../../web/app/login/login-client.tsx#L11-L12), [web/app/login/login-client.tsx:18-28](../../web/app/login/login-client.tsx#L18-L28)).
- `withToken` treats a token endpoint error or missing token as expired session and returns a 401-style API error ([web/lib/services/api.ts:20-24](../../web/lib/services/api.ts#L20-L24)). API 401 and 503 responses are preserved in the `ApiError.status`, although its generic JS error message is not structured for object details ([web/lib/services/api.ts:2-5](../../web/lib/services/api.ts#L2-L5), [web/lib/services/api.ts:16-18](../../web/lib/services/api.ts#L16-L18)).
- Logout failure leaves the current route in place and shows an inline error; success navigates to login ([web/app/workspace/workspace-sidebar-client.tsx:15-26](../../web/app/workspace/workspace-sidebar-client.tsx#L15-L26)).
- Browser-to-API calls depend on the configured public API URL and API CORS allowing the configured web origin, `GET`/`POST`, and `Authorization`/`Content-Type` ([web/lib/services/api.ts:7-15](../../web/lib/services/api.ts#L7-L15); [api/app/main.py:13-20](../../api/app/main.py#L13-L20)). Misaligned origins or URLs can break calls even when the workspace route loads.

## Verification seams

These are source-based seams to verify later; no runtime tests were run for this spike:

- Request `/workspace` without a session and confirm redirect to `/login`; sign in with the configured demo user and confirm `/workspace`, `/workspace/orders`, and an order detail route render behind the same gate ([web/app/workspace/layout.tsx:6-12](../../web/app/workspace/layout.tsx#L6-L12)).
- Confirm login error UI for rejected credentials and API/network failure, plus logout success and failure paths ([web/app/login/login-client.tsx:16-28](../../web/app/login/login-client.tsx#L16-L28); [web/app/workspace/workspace-sidebar-client.tsx:15-26](../../web/app/workspace/workspace-sidebar-client.tsx#L15-L26)).
- Inspect a browser API request for bearer header, `NEXT_PUBLIC_API_URL`, and no-store fetch behavior ([web/lib/services/api.ts:7-24](../../web/lib/services/api.ts#L7-L24)).
- Exercise the API auth contract with missing, invalid/expired, valid, and JWKS-unavailable tokens; existing coverage is in `api/tests/test_auth.py` (test source not executed during this spike). Relevant verifier behavior is in [api/app/core/auth.py:15-39](../../api/app/core/auth.py#L15-L39).

## Open questions

- Should the login page redirect an already-authenticated user to `/workspace`, or is remaining at `/login` intentional?
- Are all `/workspace` routes meant to share one session-only page gate, with finer API authorization delegated to the backend? The current layout is the sole observed web route check.
- Should token acquisition/API 401 failures trigger a centralized sign-out or login redirect? Current client service returns an error for callers to handle.
- Should API 503 due to unavailable JWKS be surfaced differently from API connectivity or business-service errors in client UX?
- Browser fetches use the public API URL directly; is a same-origin proxy deliberately out of scope? This affects deployment CORS and URL configuration.
