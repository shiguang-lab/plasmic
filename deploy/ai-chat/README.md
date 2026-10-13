# Local durable AI chat

The Studio backend accepts requests and stores project history in PostgreSQL. A separate Temporal Worker runs the model and publishes the committed outbox. The initiating Studio session executes tools through the existing native editor APIs. Collaborators observe the same project history without executing the initiator's tools.

## Start

Run from the repository root. Use the existing local PostgreSQL cluster and a private `~/.plasmic/local-web-env.json` with the native database, IAM and development API configuration used by `deploy/local-web.mjs`.

1. Install the pinned workspace dependencies: `pnpm --dir platform install --frozen-lockfile`.
2. Have the local database administrator run `deploy/ai-chat/init-local.sql`. Install `btree_gin` in `temporal_ai_visibility` before starting Temporal. The runtime role does not need superuser privileges. This bootstrap is for a new local cluster; skip role/database creation on an existing initialized cluster.
3. Start persistent services: `docker compose -f deploy/ai-chat/local-compose.yml up -d`.
4. Create the private bucket: `node deploy/ai-chat/setup-storage.mjs`.
5. Apply native database migrations: `node deploy/ai-chat/migrate.cjs`.
6. Start the backend, Studio, host and Worker: `node deploy/local-web.mjs`.

Studio uses `http://localhost:3003`; the backend, host, Temporal and S3 use ports 3004, 3005, 7233 and 8333. Real model credentials use the existing local AI configuration. `AI_CHAT_BUCKET`, `S3_ENDPOINT`, AWS credentials, `TEMPORAL_ADDRESS` and `TEMPORAL_NAMESPACE` configure the services. The compose fixture credentials apply only to the loopback development services.

`deploy/compose.yml` runs the same separate Worker and Temporal services. Set a separate `TEMPORAL_POSTGRES_PASSWORD` in its private `.env`, then run `docker compose --profile init run --rm ai-bootstrap` to provision the dedicated databases, visibility extension and private bucket before starting that stack. Runtime Node images use Debian for the Temporal native SDK.

## Data and execution contracts

- A client request UUID is unique per project and author. Retrying an accepted send returns its existing run and two role messages.
- Every project has a continuous event sequence. Message projection, tool receipt, event and outbox commit together. Streaming events contain small typed deltas; the initial snapshot and run snapshot endpoint supply their base. Socket delivery rereads the canonical committed event and checks project permission per recipient.
- Attachments live in a private S3 bucket. PostgreSQL stores names, MIME types, checksums and object references. File and image preview endpoints require project access; the browser does not persist encoded file bodies in chat history.
- Each tool has a stable operation ID, original editor session, protected scope and fencing token. Collaborators and reopened tabs cannot claim the old session. Native mutations save their receipt in the same transaction as the project revision. Lost receipt delivery retries the acknowledgment without executing the mutation again.
- Closing the panel and socket disconnect do not stop a run. Explicit stop retains output and completed changes. Worker interruption during an uncommitted model stream retains partial output and fails with an explicit interruption; it does not silently issue another model request.
- An uncertain mutation blocks further changes. Explicit saved-version verification from a new editor session fences the abandoned operation; it never repeats that operation. Retrying creates a new request after checking the current page and nodes. Undo uses the native undo record and is available only in the original editor session; historical records remain readable after reload.

## Verify

Create a dedicated local `wab_ai_test` database. The integration suite resets only that database's public schema. Use a separate `plasmic-ai-chat-integration` bucket:

```sh
cd platform/wab
AI_CHAT_INTEGRATION_DB=postgres://wab:SEKRET@localhost:5432/wab_ai_test \
AI_CHAT_BUCKET=plasmic-ai-chat-integration \
S3_ENDPOINT=http://127.0.0.1:8333 \
AWS_ACCESS_KEY_ID=local-ai-storage AWS_SECRET_ACCESS_KEY=local-ai-storage-secret \
node node_modules/vitest/vitest.mjs run --maxWorkers=1 \
  src/wab/client/copilot \
  src/wab/client/components/copilot/AiComposer.test.tsx \
  src/wab/client/components/copilot/AiAttachments.test.tsx \
  src/wab/client/components/copilot/AiMarkdown.test.tsx \
  src/wab/client/components/copilot/CopilotChatDialog.test.tsx \
  src/wab/server/copilot/local-edit.test.ts \
  src/wab/server/copilot/ai-store.integration.test.ts \
  src/wab/server/routes/local-ai.test.ts \
  src/wab/shared/copilot/dynamic-value-input.test.ts \
  src/wab/shared/copilot/fix-json.test.ts
```

From the root, run `AI_CHAT_TEST_PROJECT_ID=<disposable-local-project> node deploy/ai-chat/tests/real-model.cjs` against a test page at `/local-edit-acceptance`. It submits real model work with Markdown and PNG files, drops a saved acknowledgment, checks native operation counts, clicks the generated counter in Preview, undoes a mutation and reloads history. Start with a page containing a heading and no counter state. This modifies only the supplied test project.

Finish production builds before starting browser acceptance. The existing development frontend and production build both write to `platform/wab/build`; running them concurrently can temporarily serve an incomplete entry page.

For fault injection, stop the normal AI Worker first. Run `AI_CHAT_TEST_PROJECT_ID=<disposable-local-project> node deploy/ai-chat/tests/faults.cjs`. Keep the backend/Studio and real PostgreSQL, Temporal and S3 running. The harness starts its own loopback SSE provider and Worker, kills its own Worker during streaming, checks retained output/no repeated provider call, tests upstream disconnect, offline replay, stop and historical node navigation. It expects an `AcceptanceTitle` heading in the current page. The model fixture is used only for these fault tests. Reports and screenshots go to `/tmp/plasmic-ai-chat-acceptance`, configurable with `AI_CHAT_TEST_OUTPUT`.

The optional `acceptance-directory.mjs` supplies explicit local test identities when the native IAM relay is unavailable. It is a directory fixture, not an authentication bypass: native API tokens and project permission checks still apply. Grant the collaborator access to the test project and its template dependencies when using it.

With those fixture accounts, run `AI_CHAT_TEST_PROJECT_ID=<local-acceptance-project> AI_CHAT_TEST_TOKEN_FILE=<private-token-json> node deploy/ai-chat/tests/access.cjs`. The private JSON contains the native API tokens under `ai-acceptance-collaborator` and `ai-acceptance-outsider`. This checks identical authorized history, outsider denial for history/files, canonical socket payloads and live permission revocation. It temporarily revokes the fixture collaborator's direct project grant, restores its editor grant, and sends no share email. Use it only on the fixture project; `AI_CHAT_TEST_DIRECTORY` selects its loopback directory.

Run the entire WAB suite, including the PostgreSQL/S3 integration tests, from `platform/wab`:

```sh
CI=1 \
WAB_TEST_DATABASE_URI=postgres://wab:SEKRET@localhost:5432/wab \
WAB_TEST_SUPER_DATABASE_URI=postgres://superwab:SEKRET@localhost:5432/wab \
AI_CHAT_INTEGRATION_DB=postgres://wab:SEKRET@localhost:5432/wab_ai_test \
AI_CHAT_BUCKET=plasmic-ai-chat-integration S3_ENDPOINT=http://127.0.0.1:8333 \
AWS_ACCESS_KEY_ID=local-ai-storage AWS_SECRET_ACCESS_KEY=local-ai-storage-secret \
node node_modules/vitest/vitest.mjs run
```

The backend test helper starts an authenticated loopback identity directory for native worker processes. Loader SSR uses `tsconfig.server.json` so its published SDKs and React peers resolve together.

See `acceptance.md` for the executed local checks and limitations.
