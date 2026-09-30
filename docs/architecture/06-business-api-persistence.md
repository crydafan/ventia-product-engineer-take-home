# Spike 06: Business API and persistence

## Scope and entry points

This slice follows catalog and sample reads plus order validation, pricing, persistence, ownership-scoped retrieval, and seed/migration setup. The main entry points are `api/app/api/routes.py`, `api/app/schemas/order.py`, `api/app/services/order_service.py`, `api/app/repositories/order_repository.py`, `api/app/models/order.py`, `api/migrations/versions/0001_business.py`, and `api/scripts/seed.py`.

## Observed flow

### Business API

- The router exposes authenticated `GET /products`, `GET /customers`, `GET /sample-conversations`, `POST /orders`, `GET /orders`, and `GET /orders/{order_id}` (`api/app/api/routes.py:17-62`). The README documents the same contract (`README.md:117-127`).
- Product and customer responses are projected from SQLAlchemy rows into simple objects. Products expose ID, name, server price in cents, and currency; customers expose ID and name (`api/app/api/routes.py:22-34`). Sample conversations are read from the configured JSON seed file (`api/app/api/routes.py:37-39`).
- `POST /orders` validates the input with Pydantic, then delegates to `OrderService.create`; unknown products and business-invalid line items become `422` responses with `field`, `product_id`, and `message` in `detail` (`api/app/api/routes.py:42-49`). The README additionally warns against automatic retries because the POST is non-idempotent (`README.md:152`).

### Validation, pricing, and save

1. `OrderCreate` requires nonblank trimmed customer name and delivery address plus at least one item. Item IDs are nonblank; quantity is a strict positive integer bounded by the SQL Integer maximum. Unknown body fields are forbidden (`api/app/schemas/order.py:6-22`).
2. The service consolidates repeated product IDs, bounds aggregate quantity, fetches products from the database, rejects absent catalog IDs and non-PEN products, then derives unit prices, line totals, and order total from catalog rows (`api/app/services/order_service.py:25-66`). The request cannot supply prices because extra fields are forbidden.
3. The service creates an order snapshot with the verified `user_id`, supplied reviewed customer/address values, `created` status, and PEN currency. It is split into `build` (construct without persistence) and `create` (build then save) (`api/app/services/order_service.py:25-74`).
4. The repository saves through `db.add`, `commit`, and `refresh`, and rolls back on a service save exception (`api/app/repositories/order_repository.py:26-30`; `api/app/services/order_service.py:68-74`). List/detail reads filter `created_by` to the verified subject, with newest first (`api/app/repositories/order_repository.py:14-23`). A request for another user's order is indistinguishable from a missing order and returns `404` (`api/app/api/routes.py:57-62`).

### Persistence and seed

- SQLAlchemy models use the `business` schema, UUID-like string order IDs, a sequence-backed unique order number formatted `PED-000001`, UTC creation timestamps, and order-item relationships (`api/app/core/database.py:7-12`; `api/app/models/order.py:9-69`).
- The migration creates `business.order_number_seq`, customers, orders, products, and order_items. It adds nonnegative amount and positive quantity checks, a `created_by` index, and foreign keys from order items to orders/products (`api/migrations/versions/0001_business.py:21-90`).
- `customers` is a catalog table but `orders.customer_name` and `delivery_address` are saved as text on the order; the model has no customer foreign key (`api/app/models/order.py:22-27,29-48`). Order items snapshot product name and unit price at creation, preserving what the order was priced against if a catalog label or price later changes (`api/app/models/order.py:55-69`).
- The seed script inserts products/customers idempotently by ID and adds seed orders only when their order ID is absent. It resolves `seed_email` against Better Auth's `public.user` table, builds seed orders using the same service, and commits in one `SessionLocal.begin()` transaction (`api/scripts/seed.py:17-40`).

## Ownership and contracts

- Pydantic schemas own the request/response boundary; service logic owns order rules and monetary derivation; repository code owns persistence and user-scoped query filters; SQLAlchemy models/migration own storage shape.
- The catalog is authoritative for product prices. Values are integer PEN cents; the README gives `8000` as S/80 (`README.md:152`). The client supplies product IDs and quantities only.
- Identity is supplied by API auth dependency, not the body, and persisted as `orders.created_by`. Each user sees only their own orders.
- Current status is the literal `created`; the response schema makes both status and currency literal types (`api/app/schemas/order.py:35-46`).

## Failure states observed

- Pydantic invalid input produces `422` before service writes: blank names/addresses, empty item list, zero/negative/non-integer/oversized quantity, or extra price fields.
- The service rejects unknown products, non-PEN catalog rows, aggregate quantities beyond Integer, and line/order monetary overflow as `422`; its build phase completes before repository persistence (`api/app/services/order_service.py:28-47`). Tests assert these requests leave order listings unchanged (`api/tests/test_orders.py:53-142`).
- Product prices are read from the database at order-creation time. There is no client-supplied or quoted-price check, reservation, inventory check, tax, shipping charge calculation, or payment state in this slice.
- Database constraint/save failures are rolled back by the service and otherwise propagate; they are not all translated to a domain response (`api/app/services/order_service.py:68-74`).
- The seed script fails explicitly when the configured auth user has not been initialized (`api/scripts/seed.py:31-40`). It depends on the Better Auth public user table being present in the same configured database.

## Verification seams

- `api/tests/test_orders.py` covers strict schema limits, consolidation, server pricing, read-after-write, unknown product, currency rejection, overflow, rejection of caller prices, user scoping, authentication, no-write build, and catalog price visibility (`api/tests/test_orders.py:16-188`).
- `api/tests/test_seed.py` checks repeatability, preserving manual orders, and expected seeded records (`api/tests/test_seed.py:13-47`).
- `api/tests/conftest.py` protects integration tests from connecting to a database other than `challenge_test`; `api/migrations/env.py` gets its DB URL from the same settings object. This is the seam for testing schema and queries against PostgreSQL.
- Migration/model consistency, `alembic upgrade` on an empty test DB, rollback on persistence errors, and ordering/pagination behavior are natural future verification targets. No tests were run as part of this spike.

## Open questions

- Are customer records intended to become part of an order's durable identity, or should reviewed customer name/address remain an independent order snapshot? The present customer catalog is not referenced by orders.
- What downstream lifecycle should replace or extend the single `created` status, and which component owns payment, fulfillment, cancellation, and audit history?
- Should the create endpoint support an idempotency key for client retries? Current API and README say a repeat POST can create a second order.
- What are the intended catalog change and price semantics between proposal display and final save? Current service prices at save time and snapshots the resulting price.
- Are inventory, shipping, taxes, or quote expiration in scope? Current total is the sum of product line amounts.
- Are pagination/filtering or retention requirements expected as order volume grows? Current list returns all owned orders.
