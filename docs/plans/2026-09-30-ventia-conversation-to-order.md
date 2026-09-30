# VentIA conversation-to-order implementation record

**Date:** 2026-09-30  
**Status:** Implementation complete; checks not run  
**Product source:** `docs/prd/ventia-conversation-to-order.md`  
**Implementation plan:** `/private/tmp/ventia-conversation-to-order-implementation-plan.md`

## Starting point

The project already had an authenticated Next.js inbox, three read-only sample conversations in `data/seed.json`, a catalog API, and a FastAPI order API backed by PostgreSQL. `OrderService.build` validated catalog IDs and quantities and derived prices from the catalog. No conversation drafts or model-generation path existed. The handoff named `.agents/prd/ventia-conversation-to-order.md`, which was absent in the worktree; the checked-in PRD was at `docs/prd/ventia-conversation-to-order.md`.

## Decisions and technical approach

- Store one draft per authenticated user and conversation in `business.conversation_drafts`, using a unique `(user_id, conversation_id)` constraint and JSONB draft content.
- Hash the canonical conversation `text` server-side. Show stale drafts with a warning; permit edits and saves; require explicit acknowledgement before finalization if source text changed.
- Generate a one-pass structured proposal with the OpenAI SDK in FastAPI. The model receives the conversation and catalog IDs/names, never authoritative prices. Validate every orderable ID against the database catalog; preserve unmatched requests as warnings.
- Keep incomplete values in draft schemas. Convert to strict `OrderCreate` only during finalization.
- Finalize by locking the draft row, reusing `OrderService.build`, staging the order and deleting the draft in the same transaction, then committing once.
- In the web UI, use a responsive drawer, authenticated service wrappers, catalog-derived prices and total, debounced per-conversation saves, retry on generation failure, and duplicate-submit guards.

## Implementation sequence

1. Add the draft model and Alembic migration in the `business` schema and register the model in `api/migrations/env.py`.
2. Add Pydantic draft/proposal schemas, repository operations, OpenAI generation, and draft service logic.
3. Add authenticated GET/PUT/generate/finalize routes and permit PUT through API CORS.
4. Add TypeScript draft types and authenticated wrappers.
5. Wire the selected conversation into the workspace drawer and implement load, generate, review/edit, autosave, stale acknowledgement, finalization, and order confirmation.

## Files changed

- API: `api/app/api/routes.py`, `api/app/core/config.py`, `api/app/main.py`, `api/app/models/__init__.py`, `api/app/models/conversation_draft.py`, `api/app/repositories/conversation_draft_repository.py`, `api/app/repositories/order_repository.py`, `api/app/schemas/conversation_draft.py`, `api/app/services/conversation_draft_service.py`, `api/app/services/openai_proposal_generator.py`, `api/migrations/env.py`, `api/migrations/versions/0002_conversation_drafts.py`, `api/pyproject.toml`, `api/uv.lock`.
- Web: `web/app/workspace/workspace-client.tsx`, `web/app/workspace/conversation-order-client.tsx`, `web/lib/services/conversation-drafts.ts`, `web/lib/types/conversation-drafts.ts`.
- Documentation: this implementation record and the README “Mis decisiones” section.

## Retrospective and deviations

- The plan proposed extracting seed conversation lookup into a separate module. The implementation shares `_conversation_sources` and `_conversation_source` helpers in `api/app/api/routes.py` instead, keeping the change local to the current static seed-file source.
- The selected provider is fixed to OpenAI for this feature; the existing provider selector/check script is retained for the challenge’s pre-existing setup path.
- The OpenAI model ID remains `MODEL_NAME`, selected using the credential provided at runtime. No real credential-backed generation was performed during this implementation session.
- The repository has no web test runner, so no UI test harness was added.

## Verification and limits

No automated tests, lint, typecheck, build, migration run, browser walkthrough, or live model generation were run in this session. These checks remain needed before relying on the feature. The exact model available to the supplied credential also remains a runtime configuration choice.
