# Slice 04 — Web-to-API client and token transport

## Scope and entry points

This slice follows the browser-side call path from a workspace client component, through Better Auth token retrieval and the shared fetch helper, to the FastAPI route contract. It covers the API URL configuration point, bearer-token transport, response/error handling, service wrappers, and frontend data shapes. It does not cover backend token verification internals beyond the contract boundary.

The shared client is `web/lib/services/api.ts`. `web/lib/services/orders.ts` provides endpoint-specific functions; callers such as the inbox and orders screen invoke them inside `withToken` (`web/app/workspace/inbox-client.tsx:9-10, 30-35`; `web/app/workspace/orders/orders-client.tsx:9-11, 26-31`).

## Token and request flow

1. The workspace server layout first calls Better Auth `auth.api.getSession` and redirects if there is no session (`web/app/workspace/layout.tsx:6-12`). This gate does not itself call the business API.
2. A client component invokes `withToken(action)`. It calls `authClient.token()` and passes `data.token` into the supplied service function. An auth error or missing token becomes `ApiError` with status 401 (`web/lib/services/api.ts:20-24`). The browser auth client includes Better Auth's JWT plugin (`web/lib/auth-client.ts:1-4`).
3. `apiFetch` adds JSON content type if absent, sets `Authorization: Bearer <token>`, and forces `cache: "no-store"`. It sends to `${NEXT_PUBLIC_API_URL}${path}` (`web/lib/services/api.ts:7-15`).
4. The response body is parsed as JSON; parse failure yields `null`. Non-2xx responses throw `ApiError(status, body?.detail ?? "Error de conexión")`; successful responses are returned as the caller-selected generic type without runtime validation (`api.ts:16-18`).
5. Service wrappers map methods and paths: products, customers, sample conversations, orders list/detail, and order creation (`web/lib/services/orders.ts:1-10`). The order ID is URI-encoded for detail lookup; create serializes `OrderInput` as JSON.

The server configures Better Auth's JWT issuer from `BETTER_AUTH_URL`, audience `ventia-challenge-api`, EdDSA/Ed25519 key material, and five-minute expiry (`web/lib/auth.ts:7-24`). Its catch-all Next route exposes Better Auth GET and POST handlers (`web/app/api/auth/[...all]/route.ts:1-5`). `NEXT_PUBLIC_API_URL` is referenced directly by the request helper; this slice establishes the required setting name and concatenation behavior, not its deployment value.

## Contracts and ownership

Frontend contracts are handwritten TypeScript interfaces in `web/lib/types/orders.ts:1-25`:

- `Product`: ID, name, `price_cents`, literal PEN currency.
- `Customer`: ID and name.
- `SampleConversation`: ID, title, customer name, raw text.
- `OrderInput`: customer name, delivery address, and product ID/quantity items.
- `Order` and `OrderLine`: server-calculated names, prices, line totals, timestamp, status, currency, and total.

Endpoint wrappers and types are centralized under `web/lib/services` and `web/lib/types`. The backend's corresponding order input and response schemas are independently declared with Pydantic (`api/app/schemas/order.py:10-46`), and routes expose products/customers/sample conversations/orders (`api/app/api/routes.py:22-62`). No generated client, OpenAPI code generation, or shared cross-language schema was found in the inspected tree. TypeScript's generic return annotation is a compile-time assertion, not a runtime decoder.

The API reports order creation validation/domain failures as HTTP 422 with a structured `detail` object; the frontend `ApiError.detail` preserves arbitrary response detail, but the helper's `Error.message` uses a generic message when the detail is not a string (`api/app/api/routes.py:42-49`; `web/lib/services/api.ts:2-5`). The Orders screen currently maps status codes to user-facing states rather than displaying `detail` (`web/app/workspace/orders/orders-client.tsx:33-40`).

## Failure states and limitations

- Missing/failed Better Auth token retrieval is normalized to status 401. Inbox and orders clients use that status to show session-expired messaging and a login link (`api.ts:20-24`; `web/app/workspace/inbox-client.tsx:38-42, 67-68`; `web/app/workspace/orders/orders-client.tsx:33-40, 66-68`).
- HTTP non-success responses preserve status and `detail` in `ApiError`. A non-JSON body becomes `null`, then uses the generic connection detail (`api.ts:16-18`).
- A rejected `fetch` (network failure, bad URL, browser blocking) is not wrapped as `ApiError`; caller catch blocks handle it through their generic branch.
- Successful but malformed JSON values are cast to `T` with no runtime validation. A successful empty/non-JSON response becomes `null as T` and may fail later at the caller.
- Every call obtains a token anew through `withToken`; no shared token cache, refresh policy, retry policy, request cancellation, or API-client-level telemetry is visible here.

## Verification seams

- FastAPI endpoint contract tests include authenticated sample retrieval (`api/tests/test_sample_conversations.py:6-22`), auth enforcement (`api/tests/test_orders.py:169-173`), order validation and response behavior (`api/tests/test_orders.py:16-186`), and JWT/JWKS cases (`api/tests/test_auth.py:30-91`).
- No web-side unit/integration tests for `apiFetch`, `withToken`, or the service wrappers were found in the inspected `web` tree. They are compact seams suitable for isolated tests with mocked auth token and fetch responses. Useful boundary cases: absent token, 401/404/422 JSON response, malformed response body, network rejection, and mismatched successful payload.
- Environment wiring for `NEXT_PUBLIC_API_URL`, Better Auth URLs/secrets, and runtime routing should be verified in the environment/deployment configuration; this note only records the source references and does not validate a running deployment.

## Open questions

- Should frontend API shapes be generated from FastAPI OpenAPI or validated at runtime, especially for order creation/review contracts?
- Should network exceptions and malformed success bodies be normalized to a typed client error so callers can distinguish them from arbitrary runtime failures?
- Should repeated calls share token acquisition or use a defined refresh/retry policy? Current behavior requests a token per `withToken` invocation.
- Should callers receive typed error details (for example the 422 item/product detail) through a shared presentation contract, or continue mapping status codes locally?
- What is the canonical runtime source for `NEXT_PUBLIC_API_URL` and matching Better Auth issuer/audience settings across local, preview, and production environments?
