# Local Web development

Run `pnpm dev:web` from the repository root. It starts the source backend on
`127.0.0.1:3004`, the built-in canvas host on `127.0.0.1:3005`, and the Studio
development server on `127.0.0.1:3003`. Open `http://localhost:3003` in a browser.
The existing `concurrently` runner stops the services together.

The launcher reads a private JSON environment file from
`~/.plasmic/local-web-env.json`, or `PLASMIC_LOCAL_ENV_FILE`. Set these values:

| Key                     | Value                                                   |
| ----------------------- | ------------------------------------------------------- |
| `DATABASE_URI`          | A PostgreSQL connection to a local development database |
| `SG_IDENTITY_API_URL`   | Reachable IAM user-directory endpoint                   |
| `SG_IDENTITY_API_TOKEN` | Directory service credential                            |
| `PLASMIC_DEV_API_USER`  | Email of the IAM identity used for local editing        |
| `PLASMIC_DEV_API_TOKEN` | Native personal API token created in the local database |

Keep the file private (`chmod 600`). The development proxy supplies the native
API credentials to the local backend. Normal token validation, IAM lookup and
project permissions still apply. Credential forwarding requires a loopback bind
host, is disabled for production builds, and permits browser resource access
from the configured Studio and canvas origins. Credentials stay in the Node
processes and are not registered as frontend environment variables.

Prepare the database once, including migrations, the acceptance project and its
registered component libraries. When using a database copy, set its
`defaultHostUrl` devflag to `http://localhost:3005/static/host.html` and
`codegenOriginHost` to `http://localhost:3003`. Enable `enableLocalAiEditing` and
`enableLocalAiPageGeneration` in that local database for the AI acceptance run.
Use the existing server AI configuration in `~/.plasmic/secrets.json`, or the
`PLASMIC_AI_BASE_URL`, `PLASMIC_AI_API_KEY` and `PLASMIC_AI_MODEL` environment
variables. The built-in assistant calls the local backend and edits through
Studio's native tools.

The launcher requires the database and IAM connection to be available before
startup. If IAM is only reachable from NAS, configure an authorized local
connection to its directory service. This computer's private configuration uses
a loopback relay over SSH commands because NAS disables TCP forwarding.

Source changes are validated locally before release. Backend changes require a
launcher restart; frontend changes use the development server's rebuild flow.
For an uninterrupted AI/Preview acceptance run, use `CI=1 pnpm dev:web`; the
existing Rsbuild CI configuration disables HMR and automatic page reloads.
Reload manually after the task finishes when testing another source revision.
