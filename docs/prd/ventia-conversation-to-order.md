# VentIA: Conversation-to-order proposal

**Status:** Product scope agreed; ready for implementation planning  
**Date:** 2026-09-30  
**Source brief:** `README.md` and `guia-del-reto.html`

## Summary

Build a one-pass AI-assisted flow that turns the selected VentIA conversation into a reviewable order proposal. The advisor reviews and edits the proposal, then explicitly confirms its creation. Saved orders remain available through the existing Orders views.

The proposal is a draft, not an order. Generating or editing it must not create a persisted order.

## User and outcome

The user is a VentIA sales advisor working from a selected customer conversation. They need to understand what the customer requested, correct the proposed order, fill missing customer or delivery details, and knowingly save the resulting order.

Success means the advisor can:

1. Generate a proposal from the currently selected conversation and the real product catalog.
2. Review and correct its customer name, delivery address, products, variants, and quantities.
3. See when requested information is missing or a requested product has no catalog match.
4. Explicitly create an order from the reviewed, valid catalog items.
5. Open the saved order after creation and find it again after reloading the app.

## Agreed product decisions

- **Generation:** One AI pass creates a structured draft. There is no AI chat or clarification loop.
- **Human control:** The advisor can edit all order fields and catalog items before creation.
- **Regeneration:** Regeneration is an explicit action. It replaces the current draft only after a warning, since it may discard advisor edits.
- **Conversation separation:** Keep a distinct draft for each conversation. Switching conversations loads that conversation's draft; proposals must never be silently mixed across conversations.
- **Persistence:** Drafts must persist, including advisor edits, and be reusable without another model call when the source conversation is unchanged. The storage mechanism is an implementation-plan decision.
- **Catalog matching:** Proposal line items must reference real catalog products. Do not create free-form product lines or invent product IDs, variants, or prices.
- **No match:** Show a clear warning when the requested product cannot be matched. Do not add a made-up line item. The advisor may still save other matched catalog items after reviewing the warning.
- **Creation:** Creating an order requires a separate, explicit advisor action. The backend's existing validation still applies, including at least one valid catalog product.
- **After success:** Clear the draft for that conversation and show a confirmation with a button to open the saved order.
- **AI failure:** Show an error and offer retry. No manual blank-order fallback is required for this feature.

## Functional requirements

### 1. Start from the selected conversation

- The flow uses the selected conversation's original `text` and identity, not just its display `customer_name`.
- Generation is unavailable when no conversation is selected.
- The generated proposal is associated with the conversation that supplied its input.
- A previously saved draft for an unchanged conversation is reused. Returning to it does not trigger AI generation automatically.
- If the source conversation text has changed since the draft was generated, do not silently present the old proposal as current; provide an explicit regeneration path.

### 2. Generate a structured proposal in one pass

- Give the model the selected conversation and the available catalog records needed to identify concrete products and variants.
- The proposal may contain only catalog-backed products. A product is orderable only when it can be represented by a real catalog record.
- Interpret later customer corrections as the current request. For example, Diego's final request is one black and one white polo, both size M; do not retain the superseded quantity of two black polos.
- Extract the customer name and delivery address from the conversation when present. Do not infer an address from a matching customer name or purchase history.
- Identify missing or ambiguous required information so it is apparent during review. Keep the proposal editable while incomplete.
- If the model cannot match a requested product to a catalog record, show a warning and omit that unmatched item from order line items. Do not invent a replacement.
- AI output is a proposal only; it is not trusted as the authority for prices, totals, or order validity.

### 3. Review and edit

- The advisor can edit customer name and delivery address.
- The advisor can add, remove, replace, or change catalog-backed product variants and quantities.
- Product selection is constrained to the catalog; arbitrary text cannot be submitted as an order line.
- Display catalog prices and the resulting total from authoritative catalog/API data, not model-generated amounts.
- Missing required fields remain editable and visibly incomplete. Do not block editing merely because the initial proposal is incomplete.
- Regeneration warns that it will replace the current proposal, including the advisor's changes, and requires confirmation before proceeding.
- Persist generated proposal data and subsequent advisor edits so switching away, returning, or reloading does not require another AI call when the conversation is unchanged.

### 4. Handle conversation changes

- Maintain one independently saved draft per conversation.
- On switching to another conversation, show that conversation's draft if one exists; otherwise present the option to generate a proposal.
- Never carry line items, customer/address values, or other proposal state from one conversation into another without an explicit advisor action.
- If generation is still in flight when the advisor switches conversations, its response must not overwrite the newly selected conversation's draft or review state.

### 5. Create and confirm an order

- The advisor must explicitly confirm order creation from the review state.
- Submit only reviewed customer name, delivery address, valid catalog product IDs, and positive integer quantities. Never submit client/model prices.
- The existing API remains authoritative for product validation, prices, totals, order status, and ownership.
- The API requires a nonempty customer name and delivery address and at least one valid catalog item. If these conditions are not met, keep the draft, explain what needs attention, and do not create an order.
- If an unmatched requested product was warned about, the advisor may proceed with the matched catalog items. If no valid item remains, the existing minimum-item rule prevents creation until the advisor adds a catalog item.
- After successful creation, clear the saved draft for that conversation and show confirmation with a link/button to `/workspace/orders/{id}`.
- On creation failure, retain the draft and show an error. Do not automatically repeat the non-idempotent `POST /orders` request.

### 6. Loading and errors

- Show a clear in-progress state during generation and order creation; prevent duplicate submissions while creation is in progress.
- On AI/provider failure, show an actionable error and a retry action. Retrying generation is separate from creating an order.
- Preserve the current draft and advisor edits if regeneration fails.
- Surface validation or API errors in the review flow so the advisor can correct the relevant data.
- Keep authentication behavior consistent with the existing authenticated workspace and service calls.

## Acceptance criteria

1. **Clear order:** From Lucía's conversation, the proposal identifies two black polos, size M, and the stated address. The advisor can verify and edit the result before saving.
2. **Customer correction:** From Diego's conversation, the proposal reflects his later correction: one black polo M and one white polo M.
3. **Missing information:** From Andrea's conversation, the proposal does not assume a prior address or invent a polo size. It identifies missing information and remains editable.
4. **Catalog-only items:** Every proposed/saved line item maps to a real catalog product ID. No model-generated product IDs or prices are accepted.
5. **No match:** If no catalog item matches a request, the advisor sees a warning and the unmatched request does not become a free-form order line. Other matched items may still be saved after explicit confirmation.
6. **Persistent drafts:** A draft and its advisor edits are available after switching conversations and returning, and after reloading the app. Reopening an unchanged draft does not call the model again.
7. **Conversation isolation:** A draft generated for one conversation never appears as the draft for another conversation.
8. **Regeneration:** Regeneration requires an explicit action and warning/confirmation before replacing a draft with advisor edits.
9. **Explicit order creation:** Generating or editing a proposal creates no order. Only the separate confirmation action calls the existing order-creation API.
10. **Validation:** Invalid or incomplete order data does not create an order; the advisor can correct it in the draft.
11. **Successful creation:** The created order appears in the existing Orders experience; confirmation links to its saved detail. Its conversation draft is cleared.
12. **Failure recovery:** AI failure offers retry and preserves the draft. Order-creation failure preserves the draft and does not automatically repeat the create request.

## Scope boundaries

### In scope

- AI-backed proposal generation from the selected conversation and catalog.
- Review and editing of customer details and catalog-backed items.
- Persistent, conversation-specific drafts.
- Warnings for missing/ambiguous information and unmatched catalog requests.
- Explicit order creation through the existing API and confirmation link to the saved order.
- Loading, validation, API, and AI failure states.

### Out of scope

- Editing conversations, sending messages, or changing the inbox's read-only behavior.
- Free-form products, invented catalog records, or AI-supplied prices.
- Inventory/stock availability, reservation, or fulfillment.
- Payments, discounts, additional taxes, shipping charges, invoices, or real-store integrations.
- Customer-history lookup, inferred prior addresses, maps, or external address validation.
- AI clarification chat, agents, RAG, or a model/provider selector.
- Changes to the existing saved-order list/detail experience beyond linking to the saved order.

## Existing system constraints

- `GET /products` returns catalog `id`, `name`, `price_cents`, and `currency`.
- `POST /orders` accepts `customer_name`, `delivery_address`, and product ID/quantity items. The backend calculates price and totals and returns the saved order.
- Order creation is non-idempotent; do not automatically retry it.
- Orders are user-scoped and persist in the existing business database. The order state `created` does not imply payment, invoicing, or dispatch.
- The sample conversations and order/catalog UI are provided. This feature should reuse them rather than rebuilding the inbox or saved-order views.
- Model credentials must remain server-side.

## Implementation-plan decisions deferred

The PRD does not prescribe the technical mechanism for persistent drafts. The implementation plan should decide the persistence boundary and schema/API changes, the server-side model-call boundary, provider/model/SDK, draft invalidation/versioning, and verification approach. These choices must preserve the product requirements above.

## Source references

- `README.md` — challenge scope, business rules, AI constraints, API contracts, setup, and delivery requirements.
- `guia-del-reto.html` — four-step experience, evaluation criteria, and the three conversation cases.
- `docs/architecture/README.md` — current system boundaries and architecture walkthrough.
- `docs/architecture/03-inbox.md` — selected-conversation state and extension points.
- `docs/architecture/06-business-api-persistence.md` — catalog/order validation, pricing, persistence, and ownership.
- `docs/architecture/07-saved-order-ui.md` — saved-order routes and current UI behavior.
- `data/seed.json` — actual catalog variants and sample conversation records.
