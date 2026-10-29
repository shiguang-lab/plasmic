# Project mutations

## Manage an existing Project

These are top-level tools, callable without opening the target Project:

| Intent | Tool | Result |
| --- | --- | --- |
| Rename | `rename_project({projectId, name})` | Updated `project` identity |
| Move | `move_project({projectId, workspaceId})` | Updated `project` identity and parents |
| Copy | `clone_project({projectId, name?, workspaceId?})` | New `project` identity and actual parents |

Resolve source/destination with the hierarchy checks above. Move requires an explicit Workspace ID, including personal. Platform permissions, transfer restrictions and plan errors apply even on HTTP 200. Copy uses saved main; omitted workspace means personal, omitted name uses the platform default. Retain the returned new ID; open only when needed.

Mutating the currently open editable source saves first; unavailable model/save failure blocks it. Copy saves the current branch but copies main and leaves the source open. Rename/move reload that editor only if still active, refreshing identity/permissions. Other targets never save or navigate the active editor.

On errors, inspect `detail.operationExecuted` and run its read-only `recovery` before retrying: false = not run/rolled back by plan restriction; true = committed before readback/reload failure; null = unknown outcome. Copy readback errors retain the new ID; never copy again to recover it.

