# Repository Guidelines

## Project Structure & Modules

The repository is a pnpm workspace with a Next.js app in `web/` and a FastAPI service in `api/`. Web routes and UI live under `web/app/` and `web/components/`; shared client services and types are in `web/lib/`. API routes, schemas, services, repositories, and models are organized under `api/app/`. Alembic migrations are in `api/migrations/`, API tests in `api/tests/`, and seeded catalog/conversation data in `data/seed.json`. `compose.yaml` runs the local stack. Read `docs/architecture/README.md` before changing cross-service flows. For web changes, follow `web/AGENTS.md` and consult the installed Next.js documentation before using framework APIs.

## Build, Test & Development

- `cp .env.example .env && docker compose up --build` starts PostgreSQL, API, and web services.
- `pnpm dev` starts the web app; `pnpm build` builds it; `pnpm typecheck` runs TypeScript checks.
- `pnpm --filter web lint` runs ESLint.
- `cd api && uv sync --frozen` installs Python dependencies; `uv run uvicorn app.main:app --reload --port 8100` starts the API.
- `cd api && TEST_DATABASE_URL='<postgres URL ending in /challenge_test>' uv run pytest` runs API tests. The test fixture rejects any database not named `challenge_test`.
- `cd api && uv run ruff check .` runs Python lint checks.

## Style & Naming

Use the existing TypeScript/React and Python patterns. Keep API payload fields in `snake_case`; use descriptive component and type names in `PascalCase`, and functions/variables in `camelCase`. Python modules and functions use `snake_case`. Ruff is configured for a 100-character line length; ESLint is the web lint tool. Preserve the separation between API schemas, business services, repositories, and persistence models.

## Testing

API tests use pytest and live in `api/tests/test_*.py`; tests use the shared fixtures in `conftest.py` and a dedicated `challenge_test` database. Add or update focused API tests for behavior and validation changes. No frontend test framework or coverage threshold is configured; run lint, typecheck, and build for web changes, and describe any manual browser checks.

## Commits & Pull Requests

Recent history uses short Conventional Commit prefixes, for example `docs: add ...`, `fix: ...`, and `chore: ...`. Keep each commit focused. A pull request should explain the user-visible change, list checks run and limitations, link its issue when applicable, and include screenshots for UI changes.

## Security & Configuration

Keep secrets in the local `.env`; commit only `.env.example`. Keep model-provider credentials on the server. Never add credentials to source, screenshots, or logs. Preserve the test database name guard when changing API test setup.
