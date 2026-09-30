# Slice 03 — Conversation inbox

## Scope and entry points

The inbox route is `/workspace`. The server page renders `WorkspaceClient`, which renders `InboxClient` without props (`web/app/workspace/page.tsx:1-2`, `web/app/workspace/workspace-client.tsx:1-6`). The enclosing workspace layout checks a Better Auth server session and redirects unauthenticated users to `/login` (`web/app/workspace/layout.tsx:1-12`). The inbox then obtains an API access token in the browser and fetches sample conversations.

The slice starts at the route and ends at the sample conversation API response rendered in the list and message thread. Order creation is not part of this existing UI flow.

## Observed data and state flow

`InboxClient` owns the conversation array, selected conversation ID, search query, mobile list/detail mode, loading/error/expired flags, request sequence, and focus refs (`web/app/workspace/inbox-client.tsx:18-28`). On mount it schedules `load`; cleanup invalidates in-flight requests. `load` calls `withToken(getSamples)`, ignores stale responses using an incrementing request ID, stores returned conversations, and preserves the current selection if it still exists, otherwise selects the first result (`inbox-client.tsx:30-55`).

Search is local and case/diacritic insensitive: the query is normalized and matched against `customer_name` plus the entire raw conversation text (`inbox-client.tsx:57-58`; normalization is in `web/lib/conversations.ts:7-9`). The list receives the filtered conversations but the total unfiltered count (`inbox-client.tsx:70-71`). It derives each preview by parsing messages and choosing the last customer message, falling back to the final message (`web/components/conversations/conversation-list-client.tsx:27-44`). The selected full conversation is rendered as a read-only thread; lines prefixed `Cliente:` or `Ventas:` are converted to customer/sales messages, and unprefixed nonblank lines default to customer (`web/lib/conversations.ts:11-20`; `web/components/conversations/message-thread.tsx:4-16`).

The backend contract is a JSON array from `GET /sample-conversations`; each item has `id`, `title`, `customer_name`, and `text` (`api/app/api/routes.py:37-40`; matching frontend shape: `web/lib/types/orders.ts:1-3`). The inbox renders the `customer_name` and `text`; `title` is not used in the observed UI. The API route is protected by the router-wide authentication dependency (`api/app/api/routes.py:17-19`). Sample content comes from the configured seed JSON file (`routes.py:37-40`).

## Ownership and extension contracts

- `InboxClient` is the stateful composition boundary. `ConversationListClient` and `MessageThread` are presentational components receiving data and callbacks.
- `InboxClientProps.onConversationChange` reports the selected `SampleConversation | null` to its owner whenever the selected object changes (`inbox-client.tsx:13-16, 53-55`). `WorkspaceClient` currently supplies no callback (`workspace-client.tsx:4-6`). This is an existing seam for a sibling flow that needs the selected conversation, but no proposal/review behavior is implemented here.
- `InboxClientProps.headerActions` accepts arbitrary `ReactNode` and is rendered in the conversation header (`inbox-client.tsx:13-16, 74-79`). It is also unused by the current `WorkspaceClient`.
- List selection is reported as the whole `SampleConversation` to `onSelect`; the parent owns selected ID and mobile navigation state (`conversation-list-client.tsx:5-12, 32-34`; `inbox-client.tsx:70-71`).
- The displayed conversation is explicitly sample content and read-only (`message-thread.tsx:12-15`). There is no message mutation, reply composer, per-conversation URL, or persisted inbox selection in this slice.

## Loading, failure, and empty states

Initial load shows list and thread skeletons. On a failed load, 401 is recognized as an expired session with a link back to login; other failures show a retry button. An empty successful API result has a distinct no-conversations state. A nonempty source list with no search matches offers a clear-search action (`inbox-client.tsx:65-81`; `conversation-list-client.tsx:43-44`). Stale requests cannot overwrite newer results, and unmount invalidates the active request (`inbox-client.tsx:30-51`).

`withToken` turns token retrieval errors or a missing token into `ApiError(401)` (`web/lib/services/api.ts:20-24`). HTTP errors also become `ApiError`; transport exceptions from `fetch` are not converted in the shared client, so they reach the inbox's generic catch path (`api.ts:7-18`; `inbox-client.tsx:38-42`).

## Verification seams

- API behavior and sample fixture identity/content are covered by `api/tests/test_sample_conversations.py:6-22`.
- API authentication behavior is exercised for this endpoint and business routes in `api/tests/test_orders.py:169-173`; JWT claim/signature/JWKS handling has focused coverage in `api/tests/test_auth.py:30-91`.
- No inbox component or browser test files were found in the inspected `web` tree. Useful future seams are `getSamples`, the `onConversationChange` callback, list `onSelect`, and the exposed retry/expired/empty states. Visual/responsive behavior and focus movement need browser-level verification; source inspection alone does not establish it.

## Open questions

- Should a future AI/order flow receive the whole selected conversation or a stable identifier plus a separate data lookup? The current callback exposes the complete sample record.
- Should selection be represented in the URL or persisted if the inbox gains deep links, refresh continuity, or real conversations? It currently exists only in component state.
- The API returns `title`, but the UI ignores it and parses speaker labels from free-form `text`. Is that contract intentionally fixed for the spike, or should structured messages be a future boundary?
- Which states should remain available to `headerActions` on loading, error, or no selection? The action slot is always rendered in the header, independently of selected conversation.
