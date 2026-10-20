# Execution context and recovery

Ordinary tools never navigate to another project or silently leave Preview. Use `get_app_state.context` to inspect `surface`, `ready`, `projectId`, `branchId`, `sessionId`, `mode`, `previewKind`, `arenaId`, `componentUuid`, `frameUuid` and effective `canEdit`. `ready` means the editor model is available, not that a canvas or Preview iframe has rendered. Preview may retain a different editing selection; its actual runtime Page is in `editorContext.previewContext`.

Management queries/creation, local reference-file reads and independent media generation do not require a canvas. Model reads, contracts, validation and retained editor-view reads require the current editor session and can remain in Preview. Mutations require edit mode and effective edit permission; canvas navigation/selection also requires edit mode. Current-canvas captures require edit mode and an active canvas. An explicit `componentUuid` lets static layout/screenshot tools prepare a background canvas without changing the active arena or mode. Runtime actions require native in-app Preview, not an external popup or interactive-canvas mode.

The execution queue checks context before running each tool, including `execute` and the entire atomic `execute_batch`. A rejected precondition returns MCP `isError:true` and a JSON error body such as:

```json
{
  "error": "Tool requires edit mode; current context is Preview.",
  "code": "CONTEXT_MISMATCH",
  "operationExecuted": false,
  "required": { "surface": "editor", "mode": "edit", "canEdit": true },
  "actual": { "surface": "editor", "mode": "preview", "previewKind": "in-app", "projectId": "PROJECT_ID", "sessionId": "SESSION_ID", "ready": true },
  "recovery": [
    { "tool": "preview", "arguments": { "action": "close" } },
    { "tool": "get_app_state", "arguments": {} }
  ]
}
```

`required.previewKind` may list allowed values. A recovery step with `requiresInput` needs those arguments resolved from the task and live inventory before execution; retained editor selection does not identify the intended runtime Page. Follow the public recovery calls, confirm the intended project/session and required mode, then retry only when `operationExecuted:false` establishes that the original operation did not run. `operationExecuted:null` means a transition was attempted but did not reach its required mode; inspect current state before retrying. Reacquire Preview snapshot refs after opening or replacing runtime content; never replay expired refs. If no editor/canvas is selected, resolve the intended project/Page and explicitly call `open_design` or `navigate`; do not guess a target. External Preview must be closed through its own window. Empty recovery means no supported automatic tool recovery is available.

A context mismatch is a recoverable tool failure, not a reason to ask the user at every transition. If recovery fails, stop dependent work and report its exact error instead of looping, restarting the App, using reference tools as runtime fallback or reading client internals. Other failures do not assert that no write occurred: read back the affected model before retrying a mutation whose outcome is unknown.

## Local execution audit

For a user-authorized instrumented run, set `PLASMIC_RPC_AUDIT` to an absolute local JSONL path when starting the GUI process. The authenticated RPC boundary records each tool input and complete response (including image data and structured errors), unique `requestId`, UTC time, elapsed milliseconds and UTF-8 payload byte counts. It covers both stdio MCP and public script clients. Authentication credentials are excluded; the file is created with mode `0600`. It is separate from content-free `PLASMIC_RPC_METRICS`; their records share `requestId`. Full content is opt-in and is not default telemetry. Provider input/output/cache usage remains the model runner's responsibility and must be marked unknown when absent.

`PLASMIC_MCP_METRICS` in the MCP process records content-free tool/operation timing and input/wire/text/image bytes. RPC bytes include verifier traffic and are not retained model-context bytes.

For a DS trace, run `python3 RESOURCE_ROOT/scripts/analyze_run.py --trace /absolute/client.jsonl --mcp-metrics /absolute/mcp.jsonl --report /absolute/usage.json`. Optional `--session-log` accepts persisted DS `.zstd` chunks for auxiliary compaction usage; `--context-budget` requires the actual configured limit. The report distinguishes peak context, cumulative cached input, output and transport bytes. Never estimate provider tokens from file size or claim compaction without evidence. If client-supported compaction cannot keep the run within its budget, retain the local plan, progress and evidence and report incomplete work; MCP cannot compress an external client's history.

MCP transport processes start in the background without importing GUI startup or acquiring its single-instance lock. Reuse and close connections; a transport process is distinct from an editor window. Do not add reconnect loops or an outer system sandbox as a recovery strategy.
