# Spike 07: Saved-order UI

## Scope and entry points

This slice follows the saved-order list and detail routes from Next.js entry points through browser state, authenticated API calls, response types, and visible loading/error states. The main files are `web/app/workspace/orders/page.tsx`, `web/app/workspace/orders/[orderId]/page.tsx`, `web/app/workspace/orders/orders-client.tsx`, `web/lib/services/orders.ts`, `web/lib/services/api.ts`, and `web/lib/types/orders.ts`.

## Observed flow

1. `/workspace/orders` renders `OrdersClient` without an ID; `/workspace/orders/{orderId}` awaits route params and passes the ID to the same client component (`web/app/workspace/orders/page.tsx:1-5`; `web/app/workspace/orders/[orderId]/page.tsx:1-6`). The workspace layout checks the Better Auth session and redirects unauthenticated users to `/login` (`web/app/workspace/layout.tsx:6-12`).
2. On mount or order ID change, the client calls `load`. It increments a request generation ID, resets loading/error flags, obtains a JWT via `withToken`, then calls either `getOrders` or `getOrder`. Older responses are ignored after a newer request or unmount (`web/app/workspace/orders/orders-client.tsx:17-49`).
3. The list filters the already-loaded array locally by normalized order number or customer name (`web/app/workspace/orders/orders-client.tsx:51-53`). Each row links to the detail route and displays number/date/customer/item unit count/status/total (`web/app/workspace/orders/orders-client.tsx:84-95`).
4. Detail shows saved status, timestamp in `America/Lima`, customer, delivery address, snapshotted product names/quantities/prices, and total (`web/app/workspace/orders/orders-client.tsx:69-82`). The page states `Creado` is a recorded order and does not indicate payment, invoicing, or dispatch (`web/app/workspace/orders/orders-client.tsx:82`).
5. Both views share an explicit refresh action. The list has empty and no-search-results states; the detail has a return-to-list link (`web/app/workspace/orders/orders-client.tsx:57,63,83-94`).

## Ownership and contracts

- Route files own URL-to-view wiring; `OrdersClient` owns client-side loading state, list search, and rendering for both list and detail modes.
- `lib/services/orders.ts` owns typed order endpoint wrappers. The generic API helper sets JSON content type, bearer authorization, `cache: "no-store"`, parses response JSON, and throws `ApiError` on non-2xx responses (`web/lib/services/orders.ts:6-10`; `web/lib/services/api.ts:2-18`).
- `withToken` asks Better Auth's JWT client for the current token, maps missing/error token results to a local `401`, then invokes the action (`web/lib/services/api.ts:20-24`).
- Shared TypeScript types mirror snake_case API contracts for order input, snapshots, and output (`web/lib/types/orders.ts:1-25`). The create input intentionally contains only customer name, delivery address, product ID, and quantity.
- The backend remains authoritative for ownership and pricing; this UI renders the API's returned `total_cents`, `unit_price_cents`, and `line_total_cents` values, formatted as PEN (`web/app/workspace/orders/orders-client.tsx:13-15,79-82`).

## Failure states observed

- Initial and refresh loads show a list/detail skeleton (`web/app/workspace/orders/orders-client.tsx:66`; `web/app/workspace/orders/orders-skeleton.tsx:3-25`).
- Missing/expired token and API `401` show an expired-session message with a login link. A `404` detail response shows a not-found heading/message and no retry action. Other errors show a generic load failure with Retry (`web/app/workspace/orders/orders-client.tsx:33-40,66-68`).
- Request generation tracking prevents stale responses from replacing newer state. It does not abort the underlying fetch, but it avoids applying stale results (`web/app/workspace/orders/orders-client.tsx:24-49`).
- Empty list and zero local search matches have distinct states. Refresh is disabled while a request is in flight (`web/app/workspace/orders/orders-client.tsx:63,84-87`).

## Verification seams

- The path from order creation to saved detail has an API wrapper (`createOrder`) and navigable detail URL, while this route itself only reads (`web/lib/services/orders.ts:6-10`; `web/app/workspace/orders/orders-client.tsx:88`).
- A browser-level walkthrough can verify workspace auth redirect, list loading/empty/error states, search, refresh, list-to-detail navigation, detail not-found behavior, currency/date formatting, and narrow viewport table overflow. Source inspection alone does not establish rendered layout behavior.
- Type-level contract checks can compare `web/lib/types/orders.ts` with `api/app/schemas/order.py` and the FastAPI response model. API integration coverage exists in `api/tests/test_orders.py`, but this checkout's listed tests do not exercise the React routes.
- No UI tests or browser checks were run during this spike.

## Open questions

- Should list retrieval remain an all-orders response followed by in-memory search, or is server filtering/pagination needed at expected scale? The current `GET /orders` returns the full user-owned set.
- After future order creation, should the workflow navigate to the detail route, return to the inbox, or remain in a review context? The README identifies detail routing as an option, while this saved-order view currently has only read flows.
- Should order details expose a stable failure distinction between nonexistent IDs and IDs owned by another user? The API returns the same `404` for both, and the UI surfaces that as “does not exist or is not available for your user.”
- How should the UI present a saved price if the catalog price has changed since the order was created? The backend response carries an order snapshot and the UI renders it, but no comparison to current catalog state is made.
